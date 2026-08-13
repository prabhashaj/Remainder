import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { log } from "@/lib/logger.server";
import { env } from "node:process";

export const Route = createFileRoute("/api/webhooks/razorpay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const bodyText = await request.text();
          const signature = request.headers.get("x-razorpay-signature");

          if (!signature) {
            log("warn", "razorpay_webhook_missing_signature");
            return new Response("Missing signature", { status: 400 });
          }

          const webhookSecret = env["RAZORPAY_WEBHOOK_SECRET"];
          if (!webhookSecret) {
            log("error", "razorpay_webhook_missing_secret");
            return new Response("Internal Server Error", { status: 500 });
          }

          // Verify signature - SECURITY CRITICAL
          const expectedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(bodyText)
            .digest("hex");

          if (expectedSignature !== signature) {
            log("warn", "razorpay_webhook_invalid_signature");
            return new Response("Invalid signature", { status: 400 });
          }

          const event = JSON.parse(bodyText);
          const eventId = event.id; // Razorpay event ID for idempotency

          if (!eventId) {
             return new Response("Invalid event format", { status: 400 });
          }

          const supabase = createClient<Database>(
            env["SUPABASE_URL"]!,
            env["SUPABASE_SERVICE_ROLE_KEY"]!, // Use service role for webhooks
          );

          // 1. Check idempotency
          const { data: existingEvent } = await supabase
            .from("processed_webhook_events")
            .select("razorpay_event_id")
            .eq("razorpay_event_id", eventId)
            .maybeSingle();

          if (existingEvent) {
             log("info", "razorpay_webhook_already_processed", { eventId });
             return new Response(JSON.stringify({ ok: true, note: "already processed" }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          log("info", "razorpay_webhook_received", { event: event.event, eventId });

          // 2. Process event based on type
          const subscription = event.payload?.subscription?.entity;
          const payment = event.payload?.payment?.entity;

          if (event.event === "subscription.activated" || event.event === "subscription.charged") {
            if (subscription) {
              const userId = subscription.notes?.user_id;
              const planId = subscription.notes?.plan_id;
              
              if (userId) {
                const currentPeriodEnd = new Date(subscription.current_end * 1000).toISOString();
                
                await supabase
                  .from("subscriptions")
                  .upsert(
                    {
                      user_id: userId,
                      razorpay_subscription_id: subscription.id,
                      razorpay_customer_id: subscription.customer_id,
                      plan_id: planId,
                      tier: "active", // generic active tier flag, rely on plan_id for limits
                      status: "active",
                      current_period_end: currentPeriodEnd,
                      updated_at: new Date().toISOString(),
                    },
                    { onConflict: "user_id" },
                  );
              }
            }
          } else if (event.event === "subscription.cancelled" || event.event === "subscription.halted") {
            if (subscription) {
              const userId = subscription.notes?.user_id;
              if (userId) {
                 await supabase
                  .from("subscriptions")
                  .update({
                    status: event.event === "subscription.cancelled" ? "canceled" : "past_due",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("razorpay_subscription_id", subscription.id);
              }
            }
          } else if (event.event === "payment.failed") {
            if (payment && payment.notes?.user_id) {
               log("warn", "razorpay_payment_failed", { paymentId: payment.id, userId: payment.notes.user_id });
               // Usually handled by subscription.halted, but good to log
            }
          }

          // 3. Mark event as processed
          await supabase
            .from("processed_webhook_events")
            .insert({ razorpay_event_id: eventId });

          return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } catch (error) {
          log("error", "razorpay_webhook_error", { error: String(error) });
          return new Response("Internal Server Error", { status: 500 });
        }
      },
    },
  },
});
