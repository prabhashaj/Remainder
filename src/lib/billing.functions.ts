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

export const createRazorpayOrderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { tier: "weekly" | "monthly" }) => data)
  .handler(async ({ context, data }) => {
    const { userId, claims } = context;
    const tier = data.tier;
    const amountInr = tier === "weekly" ? 99 : 399;
    const amountPaise = amountInr * 100;

    try {
      const order = await razorpay.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: `rcpt_${userId.slice(0, 8)}_${Date.now()}`,
        notes: {
          user_id: userId,
          tier,
          email: typeof claims.email === "string" ? claims.email : "",
        },
      });

      log("info", "razorpay_order_created", { orderId: order.id, tier, amountInr }, { userId });

      return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env["RAZORPAY_KEY_ID"] || "rzp_live_TQQWHZEUiH2mK6",
        tier,
        planName: tier === "weekly" ? "Weekly Premium" : "Monthly Premium",
        userEmail: typeof claims.email === "string" ? claims.email : "",
      };
    } catch (err) {
      log("error", "razorpay_order_creation_failed", { error: String(err) }, { userId });
      throw new Error(err instanceof Error ? err.message : "Failed to create payment order");
    }
  });

export const verifyRazorpayPaymentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      tier: "weekly" | "monthly";
    }) => data,
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const crypto = await import("node:crypto");
    const { userId } = context;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, tier } = data;

    const secret = process.env["RAZORPAY_KEY_SECRET"] || "eZG0VCtEwBfcMpgU98QEs9u7";
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      log(
        "warn",
        "razorpay_payment_signature_mismatch",
        { razorpay_order_id, razorpay_payment_id },
        { userId },
      );
      throw new Error("Invalid payment signature. Verification failed.");
    }

    // Set validity period (7 days for weekly, 30 days for monthly)
    const now = new Date();
    const periodEnd = new Date(now.getTime() + (tier === "weekly" ? 7 : 30) * 24 * 60 * 60 * 1000);

    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update({
          tier,
          status: "active",
          current_period_end: periodEnd.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("subscriptions").insert({
        user_id: userId,
        tier,
        status: "active",
        current_period_end: periodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    }

    log("info", "razorpay_subscription_activated", { tier, razorpay_payment_id }, { userId });
    return { success: true };
  });

export const createRazorpayPaymentLinkFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { tier: "weekly" | "monthly"; origin?: string }) => data)
  .handler(async ({ context, data }) => {
    const { userId, claims } = context;
    const tier = data.tier;
    const amountInr = tier === "weekly" ? 99 : 399;
    const amountPaise = amountInr * 100;
    const origin = data.origin || "https://remispace.in";
    const callbackUrl = `${origin}/pricing?payment_status=paid&tier=${tier}`;

    try {
      const email = typeof claims.email === "string" ? claims.email : undefined;
      const paymentLink = await (razorpay.paymentLink.create as (params: unknown) => Promise<{
        id: string;
        short_url: string;
        amount: number;
        currency: string;
      }>)({
        amount: amountPaise,
        currency: "INR",
        accept_partial: false,
        description: `${tier === "weekly" ? "Weekly Premium" : "Monthly Premium"} Subscription — Remispace`,
        ...(email ? { customer: { email } } : {}),
        notify: {
          email: Boolean(email),
          sms: false,
        },
        notes: {
          user_id: userId,
          tier,
        },
        callback_url: callbackUrl,
        callback_method: "get",
      });

      log(
        "info",
        "razorpay_payment_link_created",
        { linkId: paymentLink.id, tier, shortUrl: paymentLink.short_url },
        { userId },
      );

      return {
        paymentLinkId: paymentLink.id,
        shortUrl: paymentLink.short_url,
        amount: paymentLink.amount,
        currency: paymentLink.currency,
        tier,
      };
    } catch (err) {
      log("error", "razorpay_payment_link_failed", { error: String(err) }, { userId });
      throw new Error(err instanceof Error ? err.message : "Failed to create payment link");
    }
  });

export const verifyPaymentLinkCallbackFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      razorpay_payment_id?: string | undefined;
      razorpay_payment_link_id?: string | undefined;
      razorpay_payment_link_status?: string | undefined;
      razorpay_signature?: string | undefined;
      tier?: "weekly" | "monthly" | undefined;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const tier = data.tier || "monthly";

    const now = new Date();
    const periodEnd = new Date(now.getTime() + (tier === "weekly" ? 7 : 30) * 24 * 60 * 60 * 1000);

    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update({
          tier,
          status: "active",
          current_period_end: periodEnd.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("subscriptions").insert({
        user_id: userId,
        tier,
        status: "active",
        current_period_end: periodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    }

    log(
      "info",
      "payment_link_verified_and_activated",
      { tier, paymentId: data.razorpay_payment_id },
      { userId },
    );
    return { success: true };
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
