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
      
      log("info", "subscription_cancel_requested", { subscriptionId: sub.razorpay_subscription_id }, { userId });
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
    const { data: sub } = await (supabase.from("subscriptions").select("*, plans(*)") as any).eq("user_id", userId).maybeSingle();
    return {
      plans: plans || [],
      subscription: sub,
      razorpayKeyId: process.env["RAZORPAY_KEY_ID"] || ""
    };
  });

export const getPlanUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { checkPlanUsage } = await import("./rate-limit.server");
    try {
      return await checkPlanUsage(supabase, userId, "api_chat");
    } catch (e) {
      return { daily: { used: 0, limit: 20 }, monthly: { used: 0, limit: 200 } };
    }
  });
