ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT 'sprout';

CREATE TABLE public.study_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roadmap_id uuid REFERENCES public.roadmaps(id) ON DELETE SET NULL,
  roadmap_item_id uuid REFERENCES public.roadmap_items(id) ON DELETE SET NULL,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'link',
  url text,
  storage_path text,
  mime_type text,
  page_count integer,
  summary text,
  key_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  extracted_text text,
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_resources TO authenticated;
GRANT ALL ON public.study_resources TO service_role;
ALTER TABLE public.study_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own study resources" ON public.study_resources FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER t_study_resources_upd BEFORE UPDATE ON public.study_resources FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_study_resources_user ON public.study_resources(user_id, created_at DESC);
CREATE INDEX idx_study_resources_roadmap ON public.study_resources(roadmap_id);

CREATE TABLE public.resource_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.study_resources(id) ON DELETE CASCADE,
  page integer NOT NULL DEFAULT 1,
  quote text NOT NULL,
  note text,
  color text NOT NULL DEFAULT 'primary',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_highlights TO authenticated;
GRANT ALL ON public.resource_highlights TO service_role;
ALTER TABLE public.resource_highlights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own highlights" ON public.resource_highlights FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER t_resource_highlights_upd BEFORE UPDATE ON public.resource_highlights FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_highlights_resource ON public.resource_highlights(resource_id, page);

CREATE TABLE public.video_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.study_resources(id) ON DELETE CASCADE,
  seconds integer NOT NULL DEFAULT 0,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_notes TO authenticated;
GRANT ALL ON public.video_notes TO service_role;
ALTER TABLE public.video_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own video notes" ON public.video_notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER t_video_notes_upd BEFORE UPDATE ON public.video_notes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_video_notes_resource ON public.video_notes(resource_id, seconds);