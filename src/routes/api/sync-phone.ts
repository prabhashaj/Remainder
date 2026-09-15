import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { env } from "node:process";

export const Route = createFileRoute("/api/sync-phone")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            userId?: string;
            phone?: string;
            countryCode?: string;
            phoneNumber?: string;
          };

          const { userId, phone, countryCode, phoneNumber } = body;

          if (!userId || !phone) {
            return new Response(
              JSON.stringify({ error: "Missing required fields: userId and phone." }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const supabaseUrl = env["SUPABASE_URL"] || env["VITE_SUPABASE_URL"];
          const serviceRoleKey = env["SUPABASE_SERVICE_ROLE_KEY"];

          if (!supabaseUrl || !serviceRoleKey) {
            return new Response(
              JSON.stringify({ error: "Supabase service role configuration missing." }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          });

          // 1. Update auth.users.phone directly via Supabase Admin API
          // This populates the "Phone" column in the Supabase Authentication Dashboard table
          const { data: updatedUser, error: updateError } =
            await admin.auth.admin.updateUserById(userId, {
              phone,
              phone_confirm: true,
              user_metadata: {
                phone,
                country_code: countryCode,
                phone_number: phoneNumber,
              },
            });

          if (updateError) {
            console.error("Failed to update auth.users.phone:", updateError);
            return new Response(
              JSON.stringify({ error: updateError.message }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          // 2. Also attempt to update public.profiles if column exists
          try {
            await admin
              .from("profiles")
              .update({
                phone,
                country_code: countryCode,
              } as any)
              .eq("id", userId);
          } catch (profileErr) {
            // Ignore if profiles table doesn't have phone column yet
          }

          return new Response(
            JSON.stringify({
              success: true,
              phone: updatedUser.user?.phone,
              userId: updatedUser.user?.id,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          console.error("Error in /api/sync-phone:", err);
          return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
