-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create the document_chunks table
create table if not exists public.document_chunks (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references public.study_resources(id) on delete cascade,
    content text not null,
    embedding vector(1024), -- Using 1024 dimensions for Mistral AI embeddings
    created_at timestamptz default now() not null
);

-- Enable Row Level Security
alter table public.document_chunks enable row level security;

-- Create policies (since users should only access chunks of their own documents)
create policy "Users can view chunks of their own documents"
    on public.document_chunks for select
    using (
        exists (
            select 1 from public.study_resources
            where study_resources.id = document_chunks.document_id
            and study_resources.user_id = auth.uid()
        )
    );

create policy "Users can insert chunks to their own documents"
    on public.document_chunks for insert
    with check (
        exists (
            select 1 from public.study_resources
            where study_resources.id = document_chunks.document_id
            and study_resources.user_id = auth.uid()
        )
    );

create policy "Users can update chunks of their own documents"
    on public.document_chunks for update
    using (
        exists (
            select 1 from public.study_resources
            where study_resources.id = document_chunks.document_id
            and study_resources.user_id = auth.uid()
        )
    );

create policy "Users can delete chunks of their own documents"
    on public.document_chunks for delete
    using (
        exists (
            select 1 from public.study_resources
            where study_resources.id = document_chunks.document_id
            and study_resources.user_id = auth.uid()
        )
    );

-- Create a function to similarity search document chunks
create or replace function match_document_chunks (
  query_embedding vector(1024),
  match_threshold float,
  match_count int,
  filter_document_id uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
    and (filter_document_id is null or document_chunks.document_id = filter_document_id)
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
$$;
