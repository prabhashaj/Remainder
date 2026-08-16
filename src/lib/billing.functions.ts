import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { razorpay } from "./razorpay.server";
import { log } from "./logger.server";

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { planId: string }) => data)
  .handler(async ({ context, data: payload }) => {
    const { supabase, userId } = context;

    try {
      const { data: plan } = await supabase
        .from("plans")
        .select("*")
        .eq("id", payload.planId)
        .single();

      if (!plan) throw new Error("Plan not found");

      // Check if user already has an active subscription
      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingSub && existingSub.status === "active") {
        throw new Error("You already have an active subscription.");
      }

      // Create Razorpay Subscription
      const subscription = await razorpay.subscriptions.create({
        plan_id: plan.razorpay_plan_id,
        customer_notify: 1,
        total_count: plan.billing_interval === "weekly" ? 52 : 12,
        notes: {
          user_id: userId,
          plan_id: plan.id,
        },
      });

      log("info", "checkout_session_created", { planId: plan.id }, { userId });

      return {
        subscriptionId: subscription.id,
        planName: plan.name,
        amount: plan.price_inr,
        currency: "INR",
      };
    } catch (error) {
      log("error", "checkout_session_error", { error: String(error) }, { userId });
      throw new Error("Failed to initialize checkout");
    }
  });

export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    try {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!sub || !sub.razorpay_subscription_id) {
        throw new Error("No active subscription found to cancel");
      }

      await razorpay.subscriptions.cancel(sub.razorpay_subscription_id, false);

      log(
        "info",
        "subscription_cancel_requested",
        { subscriptionId: sub.razorpay_subscription_id },
        { userId },
      );
      return { success: true };
    } catch (error) {
      log("error", "cancel_subscription_error", { error: String(error) }, { userId });
      throw new Error("Failed to cancel subscription");
    }
  });

export const getBillingData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: plans } = await supabase.from("plans").select("*").eq("is_active", true);
    const { data: sub } = await (supabase.from("subscriptions").select("*, plans(*)") as any)
      .eq("user_id", userId)
      .maybeSingle();
    return {
      plans: plans || [],
      subscription: sub,
      razorpayKeyId: process.env["RAZORPAY_KEY_ID"] || "",
    };
  });

export const getPlanUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { checkPlanUsage } = await import("./rate-limit.server");
    try {
      return await checkPlanUsage(supabase, userId, "api_chat");
    } catch {
      // If checkPlanUsage throws an error, it means the limit is reached.
      // We return 20/20 or 200/200 so the UI displays correctly instead of 0.
      return {
        daily: { used: 20, limit: 20, isUnlimited: false },
        monthly: { used: 200, limit: 200, isUnlimited: false },
      };
    }
  });

export const upgradeToProFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { tier?: "weekly" | "monthly" | "pro" } | undefined) => data)
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const tier = data?.tier || "monthly";

    const periodEnd = new Date();
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);

    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    let updatedSub = null;
    if (existing) {
      const { data, error } = await supabaseAdmin
        .from("subscriptions")
        .update({
          tier,
          status: "active",
          current_period_end: periodEnd.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      updatedSub = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from("subscriptions")
        .insert({
          user_id: userId,
          tier,
          status: "active",
          current_period_end: periodEnd.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      updatedSub = data;
    }

    log("info", "user_upgraded_to_pro", { tier }, { userId });
    return { success: true, subscription: updatedSub };
  });
