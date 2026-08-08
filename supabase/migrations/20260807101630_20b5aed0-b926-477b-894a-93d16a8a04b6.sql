ALTER TABLE public.roadmap_items
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.roadmap_items(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS video_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS content_status text NOT NULL DEFAULT 'empty',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS roadmap_items_parent_idx ON public.roadmap_items(parent_id);

DROP TRIGGER IF EXISTS t_roadmap_items_upd ON public.roadmap_items;
CREATE TRIGGER t_roadmap_items_upd BEFORE UPDATE ON public.roadmap_items
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();