import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getBillingData, createCheckoutSession, cancelSubscription } from "@/lib/billing.functions";
import { useEffect } from "react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function BillingSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["billing"], queryFn: () => getBillingData() });

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const checkoutMut = useMutation({
    mutationFn: createCheckoutSession,
    onSuccess: (sessionData: any) => {
      if (!data?.razorpayKeyId) {
         toast.error("Razorpay is not configured");
         return;
      }

      const options = {
        key: data.razorpayKeyId,
        subscription_id: sessionData.subscriptionId,
        name: "Remainder AI",
        description: sessionData.planName,
        handler: function (response: any) {
          toast.success("Subscription activated successfully! It may take a minute to update.");
          // We rely on the webhook to actually update the database. 
          // Re-fetch after a delay or just wait.
          setTimeout(() => qc.invalidateQueries({ queryKey: ["billing"] }), 2000);
        },
        theme: {
          color: "#4f46e5",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to initialize checkout");
    },
  });

  const cancelMut = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      toast.success("Subscription cancelled successfully. It will remain active until the billing period ends.");
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to cancel subscription");
    },
  });

  if (isLoading) return <div className="p-6">Loading billing data...</div>;

  const currentPlan = data?.subscription?.plans;
  const isPremium = currentPlan && data?.subscription?.status === "active";

  return (
    <section className="card-soft p-6">
      <h2 className="font-display text-lg font-semibold">Billing & Plans</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your subscription, view your limits, and upgrade.
      </p>

      <div className="mt-4">
        <div className="rounded-xl border p-4 bg-muted/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-medium text-lg">Current Plan: {isPremium ? currentPlan.name : "Free Tier"}</h3>
            {isPremium && (
              <p className="text-sm text-muted-foreground mt-1">
                Renews on {new Date(data?.subscription?.current_period_end || "").toLocaleDateString()}
              </p>
            )}
            {!isPremium && (
               <p className="text-sm text-muted-foreground mt-1">
                 Limited usage. Upgrade for more limits.
               </p>
            )}
          </div>
          {isPremium && (
            <Button variant="destructive" size="sm" onClick={() => cancelMut.mutate(undefined as any)} disabled={cancelMut.isPending}>
              {cancelMut.isPending ? "Canceling..." : "Cancel Subscription"}
            </Button>
          )}
        </div>
      </div>

      {!isPremium && data?.plans && data.plans.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.plans.map((plan: any) => (
            <div key={plan.id} className="rounded-xl border p-5 flex flex-col justify-between">
               <div>
                 <h4 className="font-bold text-xl">{plan.name}</h4>
                 <div className="mt-2 text-3xl font-display">₹{plan.price_inr / 100} <span className="text-sm font-normal text-muted-foreground">/{plan.billing_interval}</span></div>
                 <ul className="mt-4 space-y-2">
                   {plan.features?.map((f: string, i: number) => (
                     <li key={i} className="text-sm flex items-center gap-2">
                       <span className="text-primary">•</span> {f}
                     </li>
                   ))}
                 </ul>
               </div>
               <Button 
                  className="mt-6 w-full" 
                  onClick={() => checkoutMut.mutate({ data: { planId: plan.id } } as any)}
                  disabled={checkoutMut.isPending}
               >
                 Upgrade to {plan.name}
               </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
