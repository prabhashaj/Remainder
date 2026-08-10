-- ============================================================
-- Migration: Make URL optional for stdio support
-- ============================================================

alter table public.mcp_servers alter column url drop not null;

-- The constraint is automatically named based on the table and column, usually mcp_servers_transport_check
alter table public.mcp_servers drop constraint if exists mcp_servers_transport_check;

alter table public.mcp_servers add constraint mcp_servers_transport_check check (transport in ('sse', 'http', 'stdio'));
