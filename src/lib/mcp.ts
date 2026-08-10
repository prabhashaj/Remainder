import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface McpServer {
  id: string;
  user_id: string;
  catalog_id: string | null;
  name: string;
  url: string | null;
  transport: "sse" | "http" | "stdio";
  command: string | null;
  args: string[] | null;
  env: Record<string, string> | null;
  auth_header_encrypted: string | null;
  enabled: boolean;
  created_at: string;
}

export type McpServerInsert = Omit<McpServer, "id" | "user_id" | "created_at">;

// Client functions for UI to manage MCP Servers

export async function fetchMcpServers(supabase: ReturnType<typeof createClient<Database>>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("mcp_servers")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as McpServer[];
}

export async function createMcpServer(
  supabase: ReturnType<typeof createClient<Database>>,
  server: McpServerInsert,
  userId: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("mcp_servers")
    .insert({ ...server, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as McpServer;
}

export async function updateMcpServer(
  supabase: ReturnType<typeof createClient<Database>>,
  id: string,
  updates: Partial<McpServerInsert>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("mcp_servers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as McpServer;
}

export async function deleteMcpServer(
  supabase: ReturnType<typeof createClient<Database>>,
  id: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("mcp_servers").delete().eq("id", id);
  if (error) throw error;
}
