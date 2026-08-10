-- ============================================================
-- Migration: Add stdio fields to mcp_servers
-- ============================================================

alter table public.mcp_servers add column if not exists command text;
alter table public.mcp_servers add column if not exists args jsonb;
alter table public.mcp_servers add column if not exists env jsonb;

-- Optional: If the table was created with a check constraint on transport
-- to only allow 'sse' and 'http', we would drop and recreate it here.
-- But since standard migrations often don't enforce enum on text columns
-- strictly unless specified, this usually works.
