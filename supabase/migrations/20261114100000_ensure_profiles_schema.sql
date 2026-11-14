CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  theme text NOT NULL DEFAULT 'blush',
  font text NOT NULL DEFAULT 'inter',
  onboarded boolean NOT NULL DEFAULT false,
  notify_daily boolean NOT NULL DEFAULT true,
  notify_celebrations boolean NOT NULL DEFAULT true,
  custom_api_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'blush';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS font text NOT NULL DEFAULT 'inter';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_daily boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_celebrations boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'own profile'
  ) THEN
    CREATE POLICY "own profile" ON public.profiles
      FOR ALL TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 't_profiles_upd'
      AND tgrelid = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER t_profiles_upd
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
