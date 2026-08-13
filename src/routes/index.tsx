import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BookHeart,
  BookOpen,
  CalendarHeart,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  FileText,
  Focus,
  GraduationCap,
  Leaf,
  Menu,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import remiLogo from "@/assets/remi.png";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Remainder — a warm notebook with an AI learning coach" },
      {
        name: "description",
        content:
          "Track your days, build habits, and let Remi turn any topic into a study roadmap you actually finish — all inside one calm workspace.",
      },
      { property: "og:title", content: "Remainder — a warm notebook with an AI learning coach" },
      {
        property: "og:description",
        content:
          "Notes, habits, goals and focused learning sessions, with an encouraging AI coach called Remi.",
      },
    ],
  }),
  component: Landing,
});

const fade = { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } };

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={fade}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: reduced ? 0 : 0.55, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

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
    body: "Open resources inside Remainder, jot notes beside them, and finish with a gentle summary.",
  },
];

function PrimaryLink({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <Link
      to="/auth"
      search={{ mode: "signup" }}
      className={`group inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:-translate-y-0.5 press ${className}`}
    >
      {children}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function SectionTitle({
  eyebrow,
  title,
  body,
  center = false,
  inverse = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  body?: string;
  center?: boolean;
  inverse?: boolean;
}) {
  return (
    <Reveal className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && (
        <p
          className={`mb-3 text-xs font-semibold uppercase tracking-wider ${
            inverse ? "text-primary-foreground/80" : "text-primary font-medium"
          }`}
        >
          {eyebrow}
        </p>
      )}
      <h2
        className={`text-balance text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl ${
          inverse ? "text-primary-foreground" : "text-foreground"
        }`}
      >
        {title}
      </h2>
      {body && (
        <p
          className={`mt-4 text-pretty text-base leading-relaxed md:text-lg ${
            inverse ? "text-primary-foreground/80" : "text-muted-foreground"
          }`}
        >
          {body}
        </p>
      )}
    </Reveal>
  );
}

function WorkspacePreview() {
  const reduced = useReducedMotion();
  const nav = ["Home", "Learn", "Notes", "Goals", "Habits", "Focus", "Reflections"];
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.8, delay: 0.18 }}
      className="relative mt-14 overflow-hidden rounded-3xl border border-border/80 bg-card/60 p-2.5 shadow-lift backdrop-blur-xl md:p-4"
    >
      <div className="flex min-h-[440px] overflow-hidden rounded-2xl border border-border bg-background text-left md:min-h-[500px]">
        <aside className="hidden w-[170px] shrink-0 border-r border-border bg-muted/30 p-4 md:block">
          <div className="flex items-center gap-2">
            <img src={remiLogo} alt="Remi logo" className="size-6 rounded-lg object-cover" />
            <span className="font-display font-bold text-sm">Remainder</span>
          </div>
          <div className="mt-7 space-y-1">
            {nav.map((item, i) => (
              <div
                key={item}
                className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs ${
                  i === 0
                    ? "bg-primary/15 font-semibold text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="size-1.5 rounded-full bg-current opacity-60" />
                {item}
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-2xl bg-accent/60 p-3">
            <p className="text-[10px] font-medium text-muted-foreground">Your steady week</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-foreground">4h 28m</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[72%] rounded-full bg-primary" />
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1 p-5 md:p-7">
          <p className="text-xs text-muted-foreground">Today's Reflection</p>
          <h3 className="mt-1 text-xl font-bold tracking-tight text-foreground md:text-2xl">
            Good evening, learner.
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">A little progress is still momentum.</p>

          <div className="mt-6 rounded-2xl border border-border bg-card p-4 md:p-5 shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                  TODAY'S FOCUS
                </p>
                <p className="mt-1.5 font-bold text-foreground">Learn Transformers</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Attention mechanisms · Lesson 04
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-full border-4 border-primary/20 border-t-primary text-xs font-bold text-primary">
                42%
              </div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                whileInView={{ width: "42%" }}
                viewport={{ once: true }}
                transition={{ duration: 1.2 }}
              />
            </div>
            <button className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
              Continue lesson <ChevronRight className="size-3.5" />
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border p-3.5 bg-card/40">
              <BookOpen className="size-4 text-primary" />
              <p className="mt-2 text-xs font-semibold text-foreground">Review flashcards</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">12 cards ready</p>
            </div>
            <div className="rounded-2xl border border-border p-3.5 bg-card/40">
              <Focus className="size-4 text-primary" />
              <p className="mt-2 text-xs font-semibold text-foreground">45 min focus session</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">A quiet space awaits</p>
            </div>
          </div>
        </div>

        <div className="hidden w-[220px] shrink-0 border-l border-border bg-muted/20 p-4 lg:block">
          <div className="flex items-center gap-2">
            <img src={remiLogo} alt="Remi" className="size-7 rounded-full object-cover" />
            <p className="text-xs font-bold text-foreground">Remi Coach</p>
            <span className="ml-auto size-2 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-4 rounded-2xl bg-card border border-border/70 p-3 text-xs leading-relaxed text-muted-foreground">
            "Twelve minutes today is still momentum. Want me to shrink tomorrow's step so the streak survives?"
          </div>
          <button className="mt-3 w-full rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground shadow-xs press">
            Continue learning
          </button>
          <button className="mt-2 w-full py-1 text-xs text-muted-foreground hover:text-foreground">
            Not today
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function Landing() {
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [tab, setTab] = useState("Plan");

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/dashboard", replace: true });
      }
    });
  }, [navigate]);

  const tabContent: Record<string, { heading: string; text: string; items: string[] }> = {
    Plan: {
      heading: "Turn any goal into a path.",
      text: "Remi gently turns your ambition into a sequence you can actually begin.",
      items: ["Foundations", "Supervised Learning", "Neural Networks", "Deep Learning", "Projects"],
    },
    Learn: {
      heading: "Lessons with room to think.",
      text: "Explanations, examples, key concepts, and practice—paced for understanding.",
      items: ["Clear explanation", "Worked examples", "Key concepts", "Practice questions", "Review"],
    },
    Understand: {
      heading: "Bring your materials along.",
      text: "Ask questions of papers, PDFs, and lectures with context kept close.",
      items: ["Pre-reading brief", "Key claims", "Important concepts", "Questions", "Source references"],
    },
    Practice: {
      heading: "Remember what matters.",
      text: "Let Remi shape light review sessions from the work you've already done.",
      items: ["Flashcards", "Adaptive quizzes", "Exercises", "Revision session", "Gentle recap"],
    },
  };

  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <img
              src={remiLogo}
              alt="Remi, the Remainder coach"
              width={36}
              height={36}
              className="size-9 rounded-xl object-cover shadow-xs"
            />
            <span className="font-display text-xl font-bold tracking-tight">Remainder</span>
          </div>

          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#remi" className="transition-colors hover:text-foreground">
              AI Coach
            </a>
            <a href="#pricing" className="transition-colors hover:text-foreground">
              Pricing
            </a>
            <a href="#workspace" className="transition-colors hover:text-foreground">
              Workspace
            </a>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost" className="rounded-2xl font-medium">
              <Link to="/auth" search={{ mode: "signin" }}>
                Sign in
              </Link>
            </Button>
            <Button asChild className="rounded-2xl px-5 font-semibold press">
              <Link to="/auth" search={{ mode: "signup" }}>
                Start your notebook
              </Link>
            </Button>
          </div>

          <button
            type="button"
            aria-label="Toggle navigation"
            onClick={() => setMenu(!menu)}
            className="grid size-9 place-items-center rounded-xl bg-muted md:hidden"
          >
            {menu ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>

        {menu && (
          <div className="border-t border-border bg-background px-6 py-5 md:hidden">
            <nav className="grid gap-4 text-sm font-medium">
              <a href="#features" onClick={() => setMenu(false)}>
                Features
              </a>
              <a href="#how-it-works" onClick={() => setMenu(false)}>
                How it works
              </a>
              <a href="#remi" onClick={() => setMenu(false)}>
                AI Coach
              </a>
              <Button asChild className="rounded-2xl w-full">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Start your notebook
                </Link>
              </Button>
            </nav>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="mx-auto grid max-w-6xl gap-12 px-6 pt-12 pb-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <Reveal>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-accent-foreground border border-border/60">
            <Sparkles className="size-3.5 text-primary" /> Calm productivity, gently coached
          </span>
          <h1 className="mt-6 text-balance text-5xl font-bold leading-[1.08] tracking-tight md:text-6xl text-foreground">
            Everything you're learning, in one warm place.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Remainder is part notebook, part daily tracker, part learning coach. Write freely, keep
            your streaks, and let Remi turn "I want to learn this" into a plan that fits your week.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <PrimaryLink>Start your notebook</PrimaryLink>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-2xl px-7 font-medium press border-border"
            >
              <Link to="/auth" search={{ mode: "signin" }}>
                I already have one
              </Link>
            </Button>
          </div>
        </Reveal>

        <Reveal>
          <div className="panel-soft relative overflow-hidden p-8 border border-border bg-card/70 shadow-lift">
            <img
              src={remiLogo}
              alt="Remi mascot illustration"
              width={1024}
              height={1024}
              className="mx-auto size-52 drop-shadow-md rounded-3xl object-cover"
            />
            <div className="mt-6 rounded-2xl bg-muted/50 border border-border/80 p-5">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500" />
                <p className="font-display text-sm font-bold text-foreground">Remi AI Coach</p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground italic">
                "Twelve minutes today is still momentum. Want me to shrink tomorrow's step so the
                streak survives?"
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* 4 Feature Pillars */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article key={feature.title} className="card-soft p-6 bg-card border border-border">
              <feature.icon className="size-6 text-primary" />
              <h2 className="mt-4 font-display text-lg font-bold text-foreground">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Connected Workspace Interactive Section */}
      <section id="workspace" className="mx-auto max-w-6xl px-6 py-16">
        <SectionTitle
          eyebrow="One connected workspace"
          title="Your entire learning journey, in one place."
          body="A clear path for the bigger picture, and a gentle plan for the next hour."
        />
        <WorkspacePreview />
      </section>

      {/* Remi AI Tabs */}
      <section id="remi" className="mx-auto max-w-6xl px-6 py-20">
        <SectionTitle
          eyebrow="Meet Remi"
          title="An AI companion that learns how you learn."
          body="Remi isn't another chatbot waiting for your next prompt. It coordinates helpful capabilities to help you understand, organize, practice, and apply what you're learning."
        />
        <Reveal className="mt-10 overflow-hidden rounded-3xl border border-border bg-card shadow-lift">
          <div className="flex overflow-x-auto border-b border-border px-4 pt-3 md:px-8">
            {Object.keys(tabContent).map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setTab(name)}
                className={`relative px-5 py-3 text-sm font-semibold transition-colors ${
                  tab === name ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {name}
                {tab === name && (
                  <motion.span
                    layoutId="tab"
                    className="absolute inset-x-3 bottom-0 h-0.5 bg-primary rounded-full"
                  />
                )}
              </button>
            ))}
          </div>
          {(() => {
            const activeContent = tabContent[tab] ?? tabContent["Plan"]!;
            return (
              <div className="grid gap-8 p-6 md:grid-cols-2 md:p-10">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Remi · {tab}
                  </p>
                  <h3 className="mt-3 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                    {activeContent.heading}
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                    {activeContent.text}
                  </p>
                  <div className="mt-6">
                    <PrimaryLink>Explore Remi</PrimaryLink>
                  </div>
                </div>
                <div className="rounded-2xl bg-muted/40 border border-border/80 p-5">
                  <div className="flex items-center gap-2.5">
                    <img src={remiLogo} alt="" className="size-8 rounded-full object-cover" />
                    <div>
                      <p className="text-xs font-bold text-foreground">Remi is preparing your space</p>
                      <p className="text-[11px] text-muted-foreground">Built around your goal</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {activeContent.items.map((item, i) => (
                      <motion.div
                        key={item}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-center gap-3 rounded-xl bg-card border border-border px-3.5 py-2.5 text-xs font-medium text-foreground"
                      >
                        <span
                          className={`grid size-5 place-items-center rounded-full text-[10px] ${
                            i < 2
                              ? "bg-primary/20 text-primary font-bold"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {i < 2 ? <Check className="size-3" /> : i + 1}
                        </span>
                        {item}
                        <ChevronRight className="ml-auto size-4 text-muted-foreground/60" />
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </Reveal>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-primary/10 border-y border-border px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <SectionTitle
            eyebrow="How it works"
            title="A place to begin, and a reason to return."
            body="The path is simple. The care is in how it adapts to you."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              [
                "01",
                "Tell Remi what you're trying to accomplish.",
                "I want to learn machine learning & system design.",
              ],
              [
                "02",
                "Remi creates your path.",
                "Roadmap → Lessons → Materials → Practice → Goals",
              ],
              [
                "03",
                "Show up and make progress.",
                "Focus → Learn → Practice → Reflect → Continue",
              ],
            ].map(([num, title, desc]) => (
              <Reveal key={num} className="rounded-2xl border border-border bg-card p-6 shadow-xs">
                <p className="text-xs font-bold tracking-widest text-primary">{num}</p>
                <h3 className="mt-4 text-lg font-bold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </Reveal>
            ))}
          </div>
          <div className="mt-10">
            <PrimaryLink>Start your journey</PrimaryLink>
          </div>
        </div>
      </section>

      {/* Philosophy & Target audience */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionTitle
          center
          eyebrow="Made for the work that matters"
          title="Small steps. Deep work. Real progress."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              GraduationCap,
              "Learn a new skill",
              "Build a structured path from beginner to advanced.",
            ],
            [
              FileText,
              "Master academic material",
              "Make papers, PDFs, and lectures interactive.",
            ],
            [
              CircleHelp,
              "Prepare for interviews",
              "Practice questions with a clear, useful plan.",
            ],
            [Leaf, "Build better habits", "Create sustainable routines without guilt."],
          ].map(([Icon, title, body]) => {
            const I = Icon as typeof Leaf;
            return (
              <Reveal
                key={title as string}
                className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:-translate-y-1"
              >
                <I className="size-6 text-primary" />
                <h3 className="mt-4 font-bold text-foreground">{title as string}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {body as string}
                </p>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <SectionTitle
          center
          eyebrow="Pricing"
          title="Simple, transparent plans."
          body="Start for free, upgrade when you need more power and limits."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {/* Free Tier */}
          <Reveal className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <h3 className="text-xl font-bold text-foreground">Free Trial</h3>
            <div className="mt-4 flex items-baseline text-4xl font-extrabold text-foreground">
              ₹0<span className="ml-1 text-xl font-medium text-muted-foreground">/ forever</span>
            </div>
            <ul className="mt-8 space-y-4 text-sm text-muted-foreground">
              <li className="flex items-center">
                <Check className="mr-3 size-4 text-primary" /> 2 Roadmaps per week
              </li>
              <li className="flex items-center">
                <Check className="mr-3 size-4 text-primary" /> 5 Notebooks per week
              </li>
              <li className="flex items-center">
                <Check className="mr-3 size-4 text-primary" /> 15MB file upload limit
              </li>
            </ul>
            <div className="mt-8">
              <Button asChild variant="outline" className="w-full rounded-xl border-border">
                <Link to="/auth" search={{ mode: "signup" }}>Get Started</Link>
              </Button>
            </div>
          </Reveal>

          {/* Weekly Tier */}
          <Reveal className="relative rounded-2xl border-2 border-primary bg-card p-8 shadow-md">
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-0 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
              Most Popular
            </div>
            <h3 className="text-xl font-bold text-foreground">Weekly Premium</h3>
            <div className="mt-4 flex items-baseline text-4xl font-extrabold text-foreground">
              ₹99<span className="ml-1 text-xl font-medium text-muted-foreground">/ week</span>
            </div>
            <ul className="mt-8 space-y-4 text-sm text-muted-foreground">
              <li className="flex items-center">
                <Check className="mr-3 size-4 text-primary" /> 10 Roadmaps per week
              </li>
              <li className="flex items-center">
                <Check className="mr-3 size-4 text-primary" /> 15 Notebooks per week
              </li>
              <li className="flex items-center">
                <Check className="mr-3 size-4 text-primary" /> 50MB file upload limit
              </li>
            </ul>
            <div className="mt-8">
              <Button asChild className="w-full rounded-xl">
                <Link to="/auth" search={{ mode: "signup" }}>Upgrade Now</Link>
              </Button>
            </div>
          </Reveal>

          {/* Monthly Tier */}
          <Reveal className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <h3 className="text-xl font-bold text-foreground">Monthly Premium</h3>
            <div className="mt-4 flex items-baseline text-4xl font-extrabold text-foreground">
              ₹399<span className="ml-1 text-xl font-medium text-muted-foreground">/ month</span>
            </div>
            <ul className="mt-8 space-y-4 text-sm text-muted-foreground">
              <li className="flex items-center">
                <Check className="mr-3 size-4 text-primary" /> All Weekly Features
              </li>
              <li className="flex items-center">
                <Check className="mr-3 size-4 text-primary" /> Save ~10% over weekly
              </li>
              <li className="flex items-center">
                <Check className="mr-3 size-4 text-primary" /> Priority Support
              </li>
            </ul>
            <div className="mt-8">
              <Button asChild variant="outline" className="w-full rounded-xl border-border bg-background">
                <Link to="/auth" search={{ mode: "signup" }}>Subscribe Monthly</Link>
              </Button>
            </div>
          </Reveal>
        </div>
        <Reveal className="mt-12 rounded-2xl bg-gradient-to-br from-indigo-950 to-indigo-900 p-8 text-white max-w-5xl mx-auto shadow-sm">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold">Enterprise & Teams</h2>
              <p className="mt-2 text-indigo-200">
                Need BYOK (Bring Your Own Key) or dedicated enterprise rate limits?
              </p>
            </div>
            <button className="whitespace-nowrap rounded-xl bg-white px-6 py-3 text-sm font-semibold text-indigo-900 shadow-sm hover:bg-indigo-50">
              Contact Sales
            </button>
          </div>
        </Reveal>
      </section>

      {/* Call to action footer banner */}
      <section className="bg-primary/15 border-t border-border px-6 py-20 text-center">
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Remainder</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-balance text-4xl font-bold leading-tight tracking-tight md:text-5xl text-foreground">
            You don't need to do everything today.
            <br />
            <span className="text-primary font-normal">You just need a place to begin.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            Remainder helps you turn ambitious goals into small, meaningful steps—and keeps you
            moving without the pressure.
          </p>
          <div className="mt-8">
            <PrimaryLink>Start with Remi</PrimaryLink>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background px-6 py-10">
        <div className="mx-auto max-w-6xl flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-2.5">
            <img src={remiLogo} alt="Remi" className="size-7 rounded-lg object-cover" />
            <span className="font-display font-bold text-foreground">Remainder</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Remainder — made for slow, steady progress. © 2026 Remainder.
          </p>
        </div>
      </footer>
    </main>
  );
}
