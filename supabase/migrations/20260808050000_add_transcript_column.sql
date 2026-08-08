-- Add transcript column to study_resources for storing fetched video transcripts
ALTER TABLE public.study_resources
ADD COLUMN IF NOT EXISTS transcript text;
