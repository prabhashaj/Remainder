import { createClient } from "@supabase/supabase-js";
import { getCurrentWeekStart } from "./src/lib/limits";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function test() {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!,
  );

  // Login as test user
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "test@example.com", // Need a real email, wait we can just use the service role key!
  });

  console.log("Using service role to test upsert...");
  const adminClient = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const userId = "10e771d7-c679-44f6-8b6e-11b0ffc010b5";
  const weekStart = getCurrentWeekStart();

  console.log("Week start:", weekStart);

  const { data, error } = await adminClient
    .from("usage_logs")
    .upsert(
      {
        user_id: userId,
        week_start_date: weekStart,
        roadmaps_generated: 1,
      },
      { onConflict: "user_id,week_start_date" },
    )
    .select();

  console.log("Result:", data, error);
}

test().catch(console.error);
