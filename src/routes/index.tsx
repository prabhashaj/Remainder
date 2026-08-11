import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BookHeart, CalendarHeart, Compass, Leaf, Sparkle } from "lucide-react";
import { useEffect } from "react";

import remiLogo from "@/assets/remi.png";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Remispace — a warm notebook with an AI learning coach" },
      {
        name: "description",
        content:
          "Track your days, build habits, and let Remi turn any topic into a study roadmap you actually finish — all inside one calm workspace.",
      },
      { property: "og:title", content: "Remispace — a warm notebook with an AI learning coach" },
      {
        property: "og:description",
        content:
          "Notes, habits, goals and focused learning sessions, with an encouraging AI coach called Remi.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: BookHeart,
    title: "A notebook that bends",
    body: "Nested pages, checklists, toggles and little databases — structure only where you want it.",
  },
  {
    icon: CalendarHeart,
    title: "Days you can see",
    body: "Habit streaks, mood check-ins and progress rings that make small effort feel visible.",
  },
  {
    icon: Compass,
    title: "Roadmaps, not rabbit holes",
    body: "Remi breaks any topic into phases and drops the steps straight into your tracker.",
  },
  {
    icon: Leaf,
    title: "Focus that stays put",
    body: "Open resources inside Remispace, jot notes beside them, and finish with a gentle summary.",
  },
];

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        navigate({ to: "/dashboard", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <img
            src={remiLogo}
            alt="Remi, the Remispace coach"
            width={40}
            height={40}
            className="size-10"
          />
          <span className="font-display text-xl font-bold">Remispace</span>
        </div>
        <Button asChild variant="ghost" className="rounded-2xl">
          <Link to="/auth" search={{ mode: "signin" }}>
            Sign in
          </Link>
        </Button>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 pt-10 pb-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-accent-foreground">
            <Sparkle className="size-3.5" /> Calm productivity, gently coached
          </span>
          <h1 className="mt-6 text-balance text-5xl font-bold leading-[1.08] md:text-6xl">
            Everything you're learning, in one warm place.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Remispace is part notebook, part daily tracker, part learning coach. Write freely, keep
            your streaks, and let Remi turn "I want to learn this" into a plan that fits your week.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-2xl px-7 shadow-soft press">
              <Link to="/auth" search={{ mode: "signup" }}>
                Start your notebook
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="rounded-2xl px-7 press">
              <Link to="/auth" search={{ mode: "signin" }}>
                I already have one
              </Link>
            </Button>
          </div>
        </div>

        <div className="panel-soft relative overflow-hidden p-8">
          <img
            src={remiLogo}
            alt="Remi mascot illustration"
            width={1024}
            height={1024}
            className="mx-auto size-52 drop-shadow-sm"
          />
          <div className="mt-6 rounded-3xl bg-surface p-5">
            <p className="font-display text-sm font-semibold">Remi</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              "Twelve minutes today is still momentum. Want me to shrink tomorrow's step so the
              streak survives?"
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article key={feature.title} className="card-soft p-6">
              <feature.icon className="size-6 text-primary" />
              <h2 className="mt-4 font-display text-base font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        Remispace — made for slow, steady progress.
      </footer>
    </main>
  );
}
