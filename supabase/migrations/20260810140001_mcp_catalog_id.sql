-- ============================================================
-- Migration: Add catalog_id to mcp_servers
-- ============================================================

alter table public.mcp_servers add column if not exists catalog_id text;
