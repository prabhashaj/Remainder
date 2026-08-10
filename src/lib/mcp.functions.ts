import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createMCPClient } from "@ai-sdk/mcp";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const pingMcpServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        url: z.string().optional(),
        transport: z.enum(["sse", "http", "stdio"]),
        command: z.string().optional(),
        args: z.array(z.string()).optional(),
        env: z.record(z.string()).optional(),
        authHeader: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let transport: any;
      if (data.transport === "stdio") {
        if (!data.command) throw new Error("Missing command for stdio transport");
        const isWin = process.platform === "win32";
        const command = isWin && data.command === "npx" ? "npx.cmd" : data.command;
        transport = new StdioClientTransport({
          command,
          args: data.args || [],
          env: (data.env as Record<string, string>) || {},
        });
      } else {
        if (!data.url) throw new Error("Missing url for HTTP/SSE transport");
        transport = {
          type: data.transport,
          url: data.url,
        };
        if (data.authHeader) {
          transport.headers = { Authorization: data.authHeader };
        }
      }

      const client = await createMCPClient({ transport });

      // Attempt to list tools as a ping
      const tools = await client.tools();
      const toolCount = Object.keys(tools).length;

      return { success: true, toolCount };
    } catch (err) {
      const msg = String(err);
      if (msg.includes("fetch failed") || msg.includes("ECONNREFUSED")) {
        return {
          success: false,
          error: "Connection refused. Ensure the MCP server is running at the specified URL.",
        };
      }
      return { success: false, error: msg };
    }
  });
