import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function test() {
  const { data: users } = await supabase.auth.admin.listUsers();
  const userId = users.users[0].id;
  console.log("Testing createRoadmap for user:", userId);

  const { data: roadmap, error: rErr } = await supabase
    .from("roadmaps")
    .insert({ user_id: userId, topic: "Test Topic", summary: "Test Summary" })
    .select("id")
    .single();

  if (rErr) {
    console.error("Error inserting roadmap:", rErr);
    return;
  }
  console.log("Inserted roadmap:", roadmap.id);
  
  const { data: parent, error: tErr } = await supabase
    .from("roadmap_items")
    .insert({
      user_id: userId,
      roadmap_id: roadmap.id,
      phase: "Phase 1",
      title: "Topic 1",
      detail: "Detail 1",
      estimated_minutes: 10,
      position: 0,
    })
    .select("id")
    .single();

  if (tErr) {
    console.error("Error inserting roadmap_item:", tErr);
  } else {
    console.log("Inserted roadmap_item:", parent.id);
  }
}

test();
