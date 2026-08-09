import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { writeLesson } from "@/lib/agents/curriculum.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAiApiKey } from "@/lib/ai-gateway.server";
import { checkRateLimit } from "@/lib/rate-limit.server";

export const generateLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ itemId: z.string().max(100), force: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    try {
      await checkRateLimit(context.supabase, context.userId, "generate_lesson", 50, 60);
    } catch {
      return { success: false, error: "Too many requests. Please try again later." };
    }
    const key = getAiApiKey();
    if (!key) return { success: false, error: "AI is not configured." };
    return writeLesson({
      itemId: data.itemId,
      force: data.force ?? false,
      apiKey: key,
      supabase: context.supabase,
      userId: context.userId,
    });
  });
