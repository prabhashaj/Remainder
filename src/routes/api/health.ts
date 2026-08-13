import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { env } from "node:process";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const supabase = createClient(env["SUPABASE_URL"]!, env["SUPABASE_ANON_KEY"]!);

          // Simple health check query
          const { error } = await supabase.from("plans").select("id").limit(1);

          if (error) {
            console.error("Database health check failed:", error);
            return new Response(JSON.stringify({ status: "degraded", error: error.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(
            JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (e) {
          return new Response(JSON.stringify({ status: "error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
