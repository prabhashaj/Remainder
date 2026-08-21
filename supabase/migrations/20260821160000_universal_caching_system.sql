-- Remispace Universal Caching System (CAG + RAG)
-- 1. Curriculum Templates (Roadmap Structures)
CREATE TABLE IF NOT EXISTS public.curriculum_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic TEXT NOT NULL,
    topic_normalized TEXT NOT NULL,
    experience_level TEXT NOT NULL DEFAULT 'beginner',
    summary TEXT NOT NULL,
    structure JSONB NOT NULL,
    tags TEXT[] DEFAULT '{}',
    usage_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_curriculum_template UNIQUE (topic_normalized, experience_level)
);
CREATE INDEX IF NOT EXISTS idx_curriculum_template_lookup 
ON public.curriculum_templates (topic_normalized, experience_level);

-- 2. Subtopic Lesson Cache
CREATE TABLE IF NOT EXISTS public.lesson_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_normalized TEXT NOT NULL,
    subtopic_normalized TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    images JSONB DEFAULT '[]',
    videos JSONB DEFAULT '[]',
    usage_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_lesson_cache UNIQUE (topic_normalized, subtopic_normalized)
);
CREATE INDEX IF NOT EXISTS idx_lesson_cache_lookup 
ON public.lesson_cache (topic_normalized, subtopic_normalized);

-- 3. Study Notebook Templates Cache
CREATE TABLE IF NOT EXISTS public.notebook_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_normalized TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    icon TEXT DEFAULT '📒',
    blocks JSONB NOT NULL,
    usage_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notebook_cache_lookup 
ON public.notebook_cache (key_normalized);

-- 4. Flashcards & Quiz Cache
CREATE TABLE IF NOT EXISTS public.study_quiz_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_normalized TEXT NOT NULL,
    subtopic_normalized TEXT NOT NULL,
    questions JSONB NOT NULL,
    flashcards JSONB DEFAULT '[]',
    usage_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_study_quiz_cache UNIQUE (topic_normalized, subtopic_normalized)
);
CREATE INDEX IF NOT EXISTS idx_study_quiz_cache_lookup 
ON public.study_quiz_cache (topic_normalized, subtopic_normalized);

-- Enable Row Level Security (RLS) - Public Read for global caching, Authenticated Insert/Update
ALTER TABLE public.curriculum_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_quiz_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to curriculum_templates" 
ON public.curriculum_templates FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert/update to curriculum_templates" 
ON public.curriculum_templates FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Allow public read access to lesson_cache" 
ON public.lesson_cache FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert/update to lesson_cache" 
ON public.lesson_cache FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Allow public read access to notebook_cache" 
ON public.notebook_cache FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert/update to notebook_cache" 
ON public.notebook_cache FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Allow public read access to study_quiz_cache" 
ON public.study_quiz_cache FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert/update to study_quiz_cache" 
ON public.study_quiz_cache FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
