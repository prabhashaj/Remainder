import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getBillingData,
  createRazorpayPaymentLinkFn,
  cancelSubscription,
} from "@/lib/billing.functions";
import { isSubscriptionPremium } from "@/lib/limits";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

export function BillingSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["billing"], queryFn: () => getBillingData() });
  const createPaymentLink = useServerFn(createRazorpayPaymentLinkFn);
  const [upgradingTier, setUpgradingTier] = useState<string | null>(null);

  const handleUpgrade = async (tier: "weekly" | "monthly") => {
    setUpgradingTier(tier);
    toast.loading("Opening secure checkout…", { id: "checkout-action" });
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "https://remispace.in";
      const link = await createPaymentLink({ data: { tier, origin } });
      toast.dismiss("checkout-action");
      if (link?.shortUrl) {
        window.location.href = link.shortUrl;
      } else {
        throw new Error("Unable to create checkout link.");
      }
    } catch (err) {
      toast.dismiss("checkout-action");
      toast.error(err instanceof Error ? err.message : "Failed to initialize checkout");
      setUpgradingTier(null);
    }
  };

  const cancelMut = useMutation({
    mutationFn: () => cancelSubscription(),
    onSuccess: () => {
      toast.success(
        "Subscription cancelled successfully. It will remain active until the billing period ends.",
      );
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["subscription"] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to cancel subscription");
    },
  });

  if (isLoading) return <div className="p-6">Loading billing data...</div>;

  const sub = data?.subscription;
  const isPremium = isSubscriptionPremium(sub);
  const tierName =
    sub?.tier === "weekly"
      ? "Pro Weekly"
      : sub?.tier === "monthly"
        ? "Pro Monthly"
        : isPremium
          ? "Pro"
          : "Free Tier";

  return (
    <section className="card-soft p-6">
      <h2 className="font-display text-lg font-semibold">Billing & Plans</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your subscription, view your limits, and upgrade.
      </p>

      <div className="mt-4">
        <div className="rounded-xl border p-4 bg-muted/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-medium text-lg">
              Current Plan: {tierName}
            </h3>
            {isPremium && sub?.current_period_end && (
              <p className="text-sm text-muted-foreground mt-1">
                Valid until{" "}
                {new Date(sub.current_period_end).toLocaleDateString()}
              </p>
            )}
            {!isPremium && (
              <p className="text-sm text-muted-foreground mt-1">
                Limited usage (20 messages/day, 2 roadmaps/week). Upgrade for unlimited messages and higher limits.
              </p>
            )}
          </div>
          {isPremium && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => cancelMut.mutate()}
              disabled={cancelMut.isPending}
            >
              {cancelMut.isPending ? "Canceling..." : "Cancel Subscription"}
            </Button>
          )}
        </div>
      </div>

      {!isPremium && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border p-5 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-xl">Pro Weekly</h4>
              <div className="mt-2 text-3xl font-display">
                ₹99 <span className="text-sm font-normal text-muted-foreground">/week</span>
              </div>
              <ul className="mt-4 space-y-2">
                <li className="text-sm flex items-center gap-2">
                  <span className="text-primary">•</span> Unlimited basic AI chats
                </li>
                <li className="text-sm flex items-center gap-2">
                  <span className="text-primary">•</span> 10 Roadmaps per week
                </li>
                <li className="text-sm flex items-center gap-2">
                  <span className="text-primary">•</span> 15 Notebooks per week
                </li>
                <li className="text-sm flex items-center gap-2">
                  <span className="text-primary">•</span> 5 Deep Research per week
                </li>
                <li className="text-sm flex items-center gap-2">
                  <span className="text-primary">•</span> 50MB file uploads
                </li>
              </ul>
            </div>
            <Button
              className="mt-6 w-full"
              onClick={() => handleUpgrade("weekly")}
              disabled={upgradingTier !== null}
            >
              {upgradingTier === "weekly" ? "Opening Checkout…" : "Upgrade to Pro Weekly"}
            </Button>
          </div>

          <div className="rounded-xl border p-5 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-xl">Pro Monthly</h4>
              <div className="mt-2 text-3xl font-display">
                ₹399 <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
              <ul className="mt-4 space-y-2">
                <li className="text-sm flex items-center gap-2">
                  <span className="text-primary">•</span> Unlimited basic AI chats
                </li>
                <li className="text-sm flex items-center gap-2">
                  <span className="text-primary">•</span> 10 Roadmaps per week
                </li>
                <li className="text-sm flex items-center gap-2">
                  <span className="text-primary">•</span> 15 Notebooks per week
                </li>
                <li className="text-sm flex items-center gap-2">
                  <span className="text-primary">•</span> 5 Deep Research per week
                </li>
                <li className="text-sm flex items-center gap-2">
                  <span className="text-primary">•</span> Priority support
                </li>
              </ul>
            </div>
            <Button
              className="mt-6 w-full"
              onClick={() => handleUpgrade("monthly")}
              disabled={upgradingTier !== null}
            >
              {upgradingTier === "monthly" ? "Opening Checkout…" : "Upgrade to Pro Monthly"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
