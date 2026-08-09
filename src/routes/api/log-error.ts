import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { log } from "@/lib/logger.server";

const ErrorBody = z.object({
  message: z.string().max(2000),
  stack: z.string().max(10000).optional(),
  route: z.string().max(500).optional(),
  userId: z.string().max(200).optional(),
});

export const Route = createFileRoute("/api/log-error")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const parsed = ErrorBody.safeParse(body);
          if (!parsed.success) {
            return new Response("Invalid body", { status: 400 });
          }
          const { message, stack, route, userId } = parsed.data;
          log(
            "error",
            "client_error",
            { message, stack: stack?.slice(0, 2000), route },
            { userId },
          );
          return new Response(null, { status: 204 });
        } catch {
          return new Response(null, { status: 204 }); // always succeed silently
        }
      },
    },
  },
});
