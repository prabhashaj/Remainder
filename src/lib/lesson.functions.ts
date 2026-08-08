import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { writeLesson } from "@/lib/agents/curriculum.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAiApiKey } from "@/lib/ai-gateway.server";

export const generateLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ itemId: z.string(), force: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
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
