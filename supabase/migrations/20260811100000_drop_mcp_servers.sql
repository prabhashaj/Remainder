-- ============================================================
-- Migration: Drop orphaned MCP Servers table
-- ============================================================

DROP TABLE IF EXISTS public.mcp_servers CASCADE;
