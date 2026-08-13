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
            return new Response("Missing signature", { status: 400 });
          }

          const webhookSecret = env["RAZORPAY_WEBHOOK_SECRET"];
          if (!webhookSecret) {
            log("error", "razorpay_webhook_missing_secret");
            return new Response("Internal Server Error", { status: 500 });
          }

          // Verify signature
          const expectedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(bodyText)
            .digest("hex");

          if (expectedSignature !== signature) {
            return new Response("Invalid signature", { status: 400 });
          }

          const event = JSON.parse(bodyText);
          const supabase = createClient<Database>(
            env["SUPABASE_URL"]!,
            env["SUPABASE_SERVICE_ROLE_KEY"]!, // Use service role for webhooks
          );

          log("info", "razorpay_webhook_received", { event: event.event });

          if (event.event === "subscription.charged") {
            const subscription = event.payload.subscription.entity;
            // The notes object could contain the user_id
            const userId = subscription.notes?.user_id;

            if (userId) {
              const currentPeriodEnd = new Date(subscription.current_end * 1000).toISOString();
              
              // update or upsert subscription
              await supabase
                .from("subscriptions")
                .upsert(
                  {
                    user_id: userId,
                    razorpay_subscription_id: subscription.id,
                    tier: subscription.plan_id === env["RAZORPAY_WEEKLY_PLAN_ID"] ? "weekly" : "monthly", // You may need a better map
                    status: "active",
                    current_period_end: currentPeriodEnd,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "user_id" },
                );
            }
          } else if (event.event === "subscription.cancelled" || event.event === "subscription.halted") {
            const subscription = event.payload.subscription.entity;
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

          return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } catch (error) {
          log("error", "razorpay_webhook_error", { error: String(error) });
          return new Response("Internal Server Error", { status: 500 });
        }
      },
    },
  },
});
