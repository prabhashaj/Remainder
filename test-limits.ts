import { getRemainingLimits } from "./src/lib/limits";

async function testLimits() {
  console.log("Testing limits...");
  // We will mock fetchSubscription and fetchUsage
  const limitsMod = await import("./src/lib/limits");
  const dbMod = await import("./src/lib/db");

  // mock sub active
  dbMod.fetchSubscription = async () => ({
    id: "1",
    user_id: "1",
    tier: "weekly",
    status: "active",
    razorpay_customer_id: null,
    razorpay_subscription_id: null,
    plan_id: null,
    current_period_end: null,
    trial_ends_at: null,
    created_at: "",
    updated_at: "",
  });
  dbMod.fetchUsage = async () => null;
  console.log("Active premium:", (await limitsMod.getRemainingLimits()).isPremium);

  // mock sub trialing future
  dbMod.fetchSubscription = async () => ({
    id: "1",
    user_id: "1",
    tier: "free",
    status: "trialing",
    razorpay_customer_id: null,
    razorpay_subscription_id: null,
    plan_id: null,
    current_period_end: null,
    trial_ends_at: new Date(Date.now() + 86400000).toISOString(),
    created_at: "",
    updated_at: "",
  });
  console.log("Trialing future premium:", (await limitsMod.getRemainingLimits()).isPremium);

  // mock sub trialing past
  dbMod.fetchSubscription = async () => ({
    id: "1",
    user_id: "1",
    tier: "free",
    status: "trialing",
    razorpay_customer_id: null,
    razorpay_subscription_id: null,
    plan_id: null,
    current_period_end: null,
    trial_ends_at: new Date(Date.now() - 86400000).toISOString(),
    created_at: "",
    updated_at: "",
  });
  console.log("Trialing past premium:", (await limitsMod.getRemainingLimits()).isPremium);
}

testLimits().catch(console.error);
