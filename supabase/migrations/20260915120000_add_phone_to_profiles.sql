-- 1. Add phone and country_code to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country_code text;

-- 2. Auto-sync phone on auth.users directly if present in user metadata
CREATE OR REPLACE FUNCTION public.sync_auth_user_phone()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.phone IS NULL OR NEW.phone = '') AND NEW.raw_user_meta_data->>'phone' IS NOT NULL AND NEW.raw_user_meta_data->>'phone' != '' THEN
    NEW.phone := NEW.raw_user_meta_data->>'phone';
    NEW.phone_confirmed_at := COALESCE(NEW.phone_confirmed_at, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_phone_sync ON auth.users;
CREATE TRIGGER on_auth_user_phone_sync
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_auth_user_phone();

-- 3. Update handle_new_user to store phone in public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, phone, country_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
    NEW.raw_user_meta_data->>'country_code'
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    country_code = COALESCE(EXCLUDED.country_code, public.profiles.country_code);
  
  INSERT INTO public.subscriptions (user_id, tier, status, trial_ends_at)
  VALUES (NEW.id, 'free', 'trialing', now() + interval '7 days')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;
