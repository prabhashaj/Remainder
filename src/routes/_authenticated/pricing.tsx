import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/pricing")({
  component: PricingPage,
});

function PricingPage() {
  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) return null;
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      return sub;
    },
  });

  const handleSubscribe = async (tier: string) => {
    // In a real implementation, you would make an API call to a route that uses razorpay SDK to create a Razorpay subscription/order.
    alert(`Checkout flow for ${tier} tier using Razorpay would open here.`);
  };

  return (
    <div className="flex h-full flex-col bg-background/50">
      <main className="flex-1 space-y-6 p-6">
        <header className="mb-8 max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Upgrade to Premium</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Unlock advanced AI capabilities and higher usage limits for your learning workspace.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-3 max-w-5xl">
          {/* Free Tier */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Free Trial</h2>
            <div className="mt-4 flex items-baseline text-4xl font-extrabold">
              ₹0<span className="ml-1 text-xl font-medium text-muted-foreground">/ forever</span>
            </div>
            <ul className="mt-8 space-y-3 text-sm">
              <li className="flex items-center">
                <span className="mr-2 text-primary">✓</span> 20 daily messages with Remi
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-primary">✓</span> 2 Roadmaps per week
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-primary">✓</span> 5 Notebooks per week
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-primary">✓</span> 15MB file upload limit
              </li>
            </ul>
            <button
              disabled
              className="mt-8 w-full rounded-md bg-secondary py-2 text-sm font-semibold text-secondary-foreground"
            >
              Current Plan
            </button>
          </div>

          {/* Weekly Tier */}
          <div className="rounded-2xl border-2 border-primary bg-card p-6 shadow-md relative">
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-0 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
              Most Popular
            </div>
            <h2 className="text-xl font-semibold">Weekly Premium</h2>
            <div className="mt-4 flex items-baseline text-4xl font-extrabold">
              ₹99<span className="ml-1 text-xl font-medium text-muted-foreground">/ week</span>
            </div>
            <ul className="mt-8 space-y-3 text-sm">
              <li className="flex items-center">
                <span className="mr-2 text-primary">✓</span> Unlimited messages with Remi
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-primary">✓</span> 10 Roadmaps per week
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-primary">✓</span> 15 Notebooks per week
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-primary">✓</span> 50MB file upload limit
              </li>
            </ul>
            <button
              onClick={() => handleSubscribe("weekly")}
              className="mt-8 w-full rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {subscription?.tier === "weekly" ? "Manage Subscription" : "Subscribe Now"}
            </button>
          </div>

          {/* Monthly Tier */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Monthly Premium</h2>
            <div className="mt-4 flex items-baseline text-4xl font-extrabold">
              ₹399<span className="ml-1 text-xl font-medium text-muted-foreground">/ month</span>
            </div>
            <ul className="mt-8 space-y-3 text-sm">
              <li className="flex items-center">
                <span className="mr-2 text-primary">✓</span> All Weekly Features
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-primary">✓</span> Save ~10% over weekly
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-primary">✓</span> Priority Support
              </li>
            </ul>
            <button
              onClick={() => handleSubscribe("monthly")}
              className="mt-8 w-full rounded-md border border-border bg-background py-2 text-sm font-semibold hover:bg-muted transition-colors"
            >
              {subscription?.tier === "monthly" ? "Manage Subscription" : "Subscribe Now"}
            </button>
          </div>
        </div>

        {/* Enterprise Tier section */}
        <div className="mt-12 rounded-2xl bg-primary p-8 text-primary-foreground max-w-5xl shadow-xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold">Enterprise & Teams</h2>
              <p className="mt-2 text-primary-foreground/80">
                Need BYOK (Bring Your Own Key) or dedicated enterprise rate limits?
              </p>
            </div>
            <button className="whitespace-nowrap rounded-md bg-background px-6 py-3 text-sm font-semibold text-foreground shadow-sm hover:bg-muted transition-colors">
              Contact Sales
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
