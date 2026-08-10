import { createMCPClient } from "@ai-sdk/mcp";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tool } from "ai";

import type { Database } from "@/integrations/supabase/types";
import { log } from "@/lib/logger.server";
import { type McpServer } from "./mcp";

export async function getMcpTools(
  supabase: SupabaseClient<Database>,
  userId: string,
  traceId: string,
): Promise<Record<string, Tool>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("mcp_servers")
    .select("*")
    .eq("enabled", true)
    .eq("user_id", userId);

  if (error) {
    log("error", "mcp_servers_fetch_error", { error: error.message }, { userId, traceId });
    return {};
  }

  const servers = data as McpServer[];
  if (!servers || servers.length === 0) return {};

  const allMcpTools: Record<string, Tool> = {};

  const fetchToolsForServer = async (server: McpServer) => {
    const start = Date.now();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let transport: any;
      if (server.transport === "stdio") {
        if (!server.command) throw new Error("Missing command for stdio transport");
        const isWin = process.platform === "win32";
        const command = isWin && server.command === "npx" ? "npx.cmd" : server.command;
        transport = new StdioClientTransport({
          command,
          args: server.args || [],
          env: (server.env as Record<string, string>) || {},
        });
      } else {
        if (!server.url) throw new Error("Missing url for HTTP/SSE transport");
        transport = {
          type: server.transport,
          url: server.url,
        };
        if (server.auth_header_encrypted) {
          transport.headers = { Authorization: server.auth_header_encrypted };
        }
      }

      const client = await createMCPClient({ transport });

      const tools = await client.tools();

      for (const [toolName, mcpTool] of Object.entries(tools)) {
        const prefixedName = `mcp_${server.name.replace(/[^a-zA-Z0-9]/g, "_")}_${toolName}`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const originalExecute = mcpTool.execute;
        allMcpTools[prefixedName] = {
          ...mcpTool,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          execute: async (args: any, context: any) => {
            const result = await originalExecute(args, context);
            const strResult = typeof result === "string" ? result : JSON.stringify(result);
            if (strResult.length > 25000) {
              return {
                _warning: "The output was too large and has been truncated.",
                result: strResult.substring(0, 25000) + "... [TRUNCATED]",
              };
            }
            return result;
          },
        } as any;
      }
      log(
        "info",
        "mcp_server_connected",
        { serverName: server.name, url: server.url, durationMs: Date.now() - start },
        { userId, traceId },
      );
    } catch (err) {
      log(
        "error",
        "mcp_server_connection_failed",
        {
          serverName: server.name,
          url: server.url,
          error: String(err),
          durationMs: Date.now() - start,
        },
        { userId, traceId },
      );
    }
  };

  const withTimeout = (promise: Promise<void>, ms: number) => {
    return Promise.race([
      promise,
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout connecting to MCP Server")), ms),
      ),
    ]);
  };

  await Promise.allSettled(servers.map((s) => withTimeout(fetchToolsForServer(s), 5000)));

  return allMcpTools;
}
