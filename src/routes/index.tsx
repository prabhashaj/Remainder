import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BookHeart,
  BookOpen,
  CalendarHeart,
  Check,
  Compass,
  FileSearch,
  FileText,
  Focus,
  Menu,
  Music,
  Play,
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
      { title: "Remispace — A quiet sanctuary for deep learning & structured roadmaps" },
      {
        name: "description",
        content:
          "Block-based notes, habit rituals, intelligent PDF research, and structured study roadmaps with Remi — a calm AI learning coach designed for lifelong learners.",
      },
      {
        property: "og:title",
        content: "Remispace — A quiet sanctuary for deep learning & structured roadmaps",
      },
      {
        property: "og:description",
        content:
          "Notes, habits, goals, ambient focus sessions, and structured study roadmaps in one warm, distraction-free workspace.",
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
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: reduced ? 0 : 0.55, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

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
        className={`text-balance text-4xl font-bold leading-[1.15] tracking-tight md:text-5xl font-display ${
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

/* -------------------------------------------------------------------------- */
/* Interactive Workspace Showcase Mockup                                      */
/* -------------------------------------------------------------------------- */
function WorkspaceShowcase() {
  const reduced = useReducedMotion();
  const nav = [
    { label: "Dashboard", icon: BookHeart },
    { label: "Roadmaps", icon: Compass },
    { label: "Documents", icon: FileSearch },
    { label: "Habits", icon: CalendarHeart },
    { label: "Focus Studio", icon: Focus },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.8, delay: 0.18 }}
      className="relative mt-12 overflow-hidden rounded-3xl border border-border/80 bg-card/70 p-2.5 shadow-lift backdrop-blur-xl md:p-4 text-left"
    >
      <div className="flex min-h-[460px] overflow-hidden rounded-2xl border border-border bg-background md:min-h-[520px]">
        {/* Left Sidebar */}
        <aside className="hidden w-[190px] shrink-0 border-r border-border bg-muted/20 p-4 md:block">
          <div className="flex items-center gap-2.5">
            <img src={remiLogo} alt="Remispace logo" className="size-6 rounded-lg object-cover" />
            <span className="font-display font-bold text-sm text-foreground">Remispace</span>
          </div>

          <div className="mt-6 space-y-1">
            {nav.map((item, i) => (
              <div
                key={item.label}
                className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium ${
                  i === 1
                    ? "bg-primary/15 font-semibold text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className="size-3.5" />
                {item.label}
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl bg-card border border-border/70 p-3 shadow-xs">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Weekly Momentum
            </p>
            <p className="mt-1 text-xl font-bold tracking-tight text-foreground">5h 42m</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[84%] rounded-full bg-primary" />
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">4 of 5 habits on streak 🔥</p>
          </div>
        </aside>

        {/* Center Main Stage */}
        <div className="min-w-0 flex-1 p-5 md:p-7">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Compass className="size-3.5" /> Active Curriculum
            </span>
            <span className="text-xs text-muted-foreground">Updated 10m ago</span>
          </div>

          <h3 className="mt-3 text-xl font-bold tracking-tight text-foreground md:text-2xl font-display">
            Machine Learning & Attention Architectures
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Phase 2 of 4 · Deep Sequence Models & Transformers
          </p>

          <div className="mt-6 rounded-2xl border border-border bg-card p-4 md:p-5 shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold text-primary uppercase tracking-wider">
                  CURRENT LESSON
                </p>
                <p className="mt-1 font-bold text-foreground">Self-Attention & Multi-Head Projections</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Formula: Attention(Q,K,V) = softmax((QK^T) / sqrt(d_k)) * V
                </p>
              </div>
              <div className="grid size-12 place-items-center rounded-full border-4 border-primary/20 border-t-primary text-xs font-bold text-primary">
                68%
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-lg bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-foreground">
                ✓ Query, Key & Value Vectors
              </span>
              <span className="rounded-lg bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-foreground">
                ✓ Scaled Dot-Product
              </span>
              <span className="rounded-lg bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary">
                → Multi-Head Stacking
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border p-3.5 bg-card/50">
              <FileSearch className="size-4 text-primary" />
              <p className="mt-2 text-xs font-semibold text-foreground">Research Paper Attached</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                "Attention Is All You Need" (Vaswani et al.)
              </p>
            </div>
            <div className="rounded-2xl border border-border p-3.5 bg-card/50">
              <Focus className="size-4 text-primary" />
              <p className="mt-2 text-xs font-semibold text-foreground">Ambient Study Session</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                25m Pomodoro · Rainy Café Audio
              </p>
            </div>
          </div>
        </div>

        {/* Right Remi Coach Panel */}
        <div className="hidden w-[240px] shrink-0 border-l border-border bg-muted/20 p-4 lg:block">
          <div className="flex items-center gap-2">
            <img src={remiLogo} alt="Remi" className="size-7 rounded-full object-cover" />
            <div>
              <p className="text-xs font-bold text-foreground">Remi Coach</p>
              <p className="text-[10px] text-emerald-500 font-medium">● Online & Ready</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-card border border-border/80 p-3.5 text-xs leading-relaxed text-muted-foreground shadow-xs">
            "You mastered Scaled Dot-Product faster than usual. Ready to see how multi-head projections allow the network to attend to information from different representation subspaces?"
          </div>

          <div className="mt-3 space-y-2">
            <button className="w-full rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground shadow-xs press">
              Start 15m Interactive Lesson
            </button>
            <button className="w-full rounded-xl border border-border bg-background py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors">
              Ask a question about this paper
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Landing Component                                                     */
/* -------------------------------------------------------------------------- */
function Landing() {
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "roadmaps" | "documents" | "focus" | "notes" | "habits"
  >("roadmaps");

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/dashboard", replace: true });
      }
    });
  }, [navigate]);

  const features = [
    {
      icon: Compass,
      title: "Intelligent Study Roadmaps",
      body: "Remi transforms any ambition—from mastering quantum mechanics to learning Spanish—into structured milestones, checkpoints, and bite-sized daily lessons.",
    },
    {
      icon: FileSearch,
      title: "Document & PDF Intelligence",
      body: "Upload textbooks, research papers, and lecture slides. Interactively summarize, extract key theorems, search across pages, and test yourself with flashcards.",
    },
    {
      icon: Focus,
      title: "Ambient Focus Studio",
      body: "Enter distraction-free flow with customizable Pomodoro timers, real-time meteorological weather, and relaxing ambient audio soundscapes.",
    },
    {
      icon: BookOpen,
      title: "Sensory Block-Based Notes",
      body: "A clean, beautiful canvas with full KaTeX math equation rendering, code blocks, toggleable callouts, and handcrafted pastel color themes.",
    },
    {
      icon: CalendarHeart,
      title: "Habit Rituals & Momentum",
      body: "Build lasting routines without the guilt. Visual habit heatmaps, streak preservation, and daily task management keep you grounded.",
    },
    {
      icon: Sparkles,
      title: "Remi AI Learning Companion",
      body: "An encouraging coach with persistent memory that remembers your past questions, schedule, and learning style across every session.",
    },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <img
              src={remiLogo}
              alt="Remispace logo"
              width={34}
              height={34}
              className="size-8.5 rounded-xl object-cover shadow-xs"
            />
            <span className="font-display text-xl font-bold tracking-tight text-foreground">
              Remispace
            </span>
          </div>

          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#interactive-preview" className="transition-colors hover:text-foreground">
              Explore
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#pricing" className="transition-colors hover:text-foreground">
              Pricing
            </a>
          </nav>

          <div className="hidden items-center gap-2.5 md:flex">
            <Button asChild variant="ghost" className="rounded-2xl font-medium">
              <Link to="/auth" search={{ mode: "signin" }}>
                Sign in
              </Link>
            </Button>
            <Button asChild className="rounded-2xl px-5 font-semibold press">
              <Link to="/auth" search={{ mode: "signup" }}>
                Start for free
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
              <a href="#interactive-preview" onClick={() => setMenu(false)}>
                Explore
              </a>
              <a href="#how-it-works" onClick={() => setMenu(false)}>
                How it works
              </a>
              <a href="#pricing" onClick={() => setMenu(false)}>
                Pricing
              </a>
              <Button asChild className="rounded-2xl w-full">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Start your workspace
                </Link>
              </Button>
            </nav>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-20 text-center">
        <Reveal>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-accent-foreground border border-border/60">
            <Sparkles className="size-3.5 text-primary" /> A calm sanctuary for deep learning
          </span>

          <h1 className="mx-auto mt-6 max-w-4xl text-balance text-5xl font-bold leading-[1.08] tracking-tight md:text-6xl lg:text-7xl text-foreground font-display">
            The thoughtful workspace for everything you're learning.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground md:text-xl">
            Remispace combines structured study roadmaps, intelligent PDF research, habit rituals,
            and ambient focus studios with Remi—a calm AI learning coach who turns complex
            disciplines into daily momentum.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <PrimaryLink>Start your learning workspace</PrimaryLink>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-2xl px-7 font-medium press border-border"
            >
              <Link to="/auth" search={{ mode: "signin" }}>
                Sign in to existing
              </Link>
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Free forever tier · No credit card required · Instant setup
          </p>
        </Reveal>

        {/* Main Workspace Showcase */}
        <WorkspaceShowcase />
      </section>

      {/* 6 Core Feature Pillars */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20 border-t border-border/60">
        <SectionTitle
          eyebrow="Crafted for deep thinking"
          title="Everything you need to master complex subjects."
          body="Traditional note apps are passive containers. Generic AI chatbots lose your context. Remispace unites structure, materials, and coaching into one harmonious rhythm."
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Reveal
              key={f.title}
              className="group rounded-3xl border border-border bg-card p-7 shadow-soft transition hover:-translate-y-1 hover:shadow-lift"
            >
              <div className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <f.icon className="size-5.5" />
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-foreground">{f.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Interactive Feature Deep Dive (Tabbed Showcase) */}
      <section id="interactive-preview" className="bg-muted/30 border-y border-border px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <SectionTitle
            center
            eyebrow="Interactive Experience"
            title="Explore how Remispace powers your daily study."
            body="Click through each core module below to see how Remispace organizes your thoughts, materials, and focus."
          />

          {/* Tab Navigation */}
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {[
              { id: "roadmaps", label: "Study Roadmaps", icon: Compass },
              { id: "documents", label: "Document AI & PDFs", icon: FileSearch },
              { id: "focus", label: "Focus Studio & Audio", icon: Focus },
              { id: "notes", label: "Notes & KaTeX Math", icon: BookOpen },
              { id: "habits", label: "Habits & Rituals", icon: CalendarHeart },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as typeof activeTab)}
                className={`press flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-all ${
                  activeTab === t.id
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="size-4" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content Display */}
          <Reveal className="mt-8 overflow-hidden rounded-3xl border border-border bg-card p-6 md:p-10 shadow-lift">
            {activeTab === "roadmaps" && (
              <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    Module 01 · Structured Mastery
                  </span>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl font-display">
                    Transform any subject into a step-by-step curriculum.
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                    Whether you're preparing for technical interviews, learning machine learning, or
                    studying history, Remi decomposes the syllabus into phases, milestones, and
                    actionable daily lessons that prevent overwhelm.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-foreground">
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-primary" /> Automatic checkpoint & quiz
                      generation
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-primary" /> Adaptive pacing based on your
                      learning speed
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-primary" /> Directly connected to your daily
                      task list
                    </li>
                  </ul>
                  <div className="mt-8">
                    <PrimaryLink>Build your first roadmap</PrimaryLink>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background p-5 shadow-xs">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <span className="text-xs font-bold text-foreground">Curriculum Preview</span>
                    <span className="text-[11px] text-primary font-semibold">Phase 1 / 4 Complete</span>
                  </div>
                  <div className="mt-4 space-y-2.5">
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-foreground flex items-center justify-between">
                      <span>✓ 1. Mathematical Foundations & Linear Algebra</span>
                      <span className="text-[10px] text-emerald-600 font-bold uppercase">Passed</span>
                    </div>
                    <div className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-xs font-semibold text-primary flex items-center justify-between">
                      <span>→ 2. Loss Functions & Gradient Descent Optimization</span>
                      <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-md">
                        Active
                      </span>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-3 text-xs font-medium text-muted-foreground flex items-center justify-between">
                      <span>3. Neural Network Backpropagation from Scratch</span>
                      <span className="text-[10px] text-muted-foreground">Upcoming</span>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-3 text-xs font-medium text-muted-foreground flex items-center justify-between">
                      <span>4. Transformers & Multi-Head Self Attention</span>
                      <span className="text-[10px] text-muted-foreground">Upcoming</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "documents" && (
              <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    Module 02 · Deep Document Research
                  </span>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl font-display">
                    Interactive PDF reader with theorem extraction.
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                    Upload textbooks, lecture slide decks, and dense academic papers. Remi indexes
                    your materials, allowing you to ask questions with exact page references,
                    generate pre-reading briefs, and extract formulas into your notes.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-foreground">
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-primary" /> Instant document synthesis &
                      chapter summaries
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-primary" /> Page-by-page citations with inline
                      snippets
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-primary" /> 1-click flashcard deck generation
                    </li>
                  </ul>
                  <div className="mt-8">
                    <PrimaryLink>Try Document AI</PrimaryLink>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background p-5 shadow-xs">
                  <div className="flex items-center gap-2 border-b border-border pb-3">
                    <FileText className="size-4 text-primary" />
                    <span className="text-xs font-bold text-foreground">
                      Paper: Deep Residual Learning for Image Recognition.pdf
                    </span>
                  </div>
                  <div className="mt-4 rounded-xl bg-card border border-border p-3 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">Key Concept Extracted:</span>
                    "Residual mapping allows layers to fit residual functions instead of unreferenced ones, preventing the degradation problem in deep networks."
                  </div>
                  <div className="mt-3 rounded-xl bg-primary/10 border border-primary/20 p-3 text-xs text-primary font-medium">
                    💡 Remi generated 8 review flashcards for this section.
                  </div>
                </div>
              </div>
            )}

            {activeTab === "focus" && (
              <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    Module 03 · Ambient Focus Studio
                  </span>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl font-display">
                    Distraction-free flow state for deep work.
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                    Silence the noise of the internet. The Focus Studio provides customizable
                    Pomodoro intervals, real-time local weather updates, calming background audio,
                    and end-of-session reflection logs.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-foreground">
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-primary" /> Fullscreen deep work mode with
                      countdown
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-primary" /> Ambient soundscapes: Rain, Coffee
                      Shop, Forest, White Noise
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-primary" /> Live weather integration & gentle
                      breaks
                    </li>
                  </ul>
                  <div className="mt-8">
                    <PrimaryLink>Open Focus Studio</PrimaryLink>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background p-6 text-center shadow-xs">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    POMODORO INTERVAL
                  </span>
                  <div className="mt-3 text-5xl font-extrabold tracking-tight text-foreground font-mono">
                    25:00
                  </div>
                  <p className="mt-2 text-xs text-primary font-semibold">
                    Rainy Afternoon · 22°C Overcast
                  </p>
                  <div className="mt-6 flex justify-center gap-3">
                    <button className="rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground shadow-soft press flex items-center gap-1.5">
                      <Play className="size-3.5 fill-current" /> Start Focus
                    </button>
                    <button className="rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors flex items-center gap-1.5">
                      <Music className="size-3.5" /> Ambient Audio
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "notes" && (
              <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    Module 04 · Mathematical Canvas
                  </span>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl font-display">
                    Block-based notebook with native KaTeX rendering.
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                    A calm, fluid text editor that handles equations, syntax-highlighted code,
                    nested subpages, and interactive toggle lists effortlessly. Never compromise
                    between beauty and technical rigor.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-foreground">
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-primary" /> Instant LaTeX math rendering with
                      KaTeX
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-primary" /> 10+ handcrafted sensory color
                      themes
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-primary" /> Seamless inline Remi assistant
                      prompts
                    </li>
                  </ul>
                  <div className="mt-8">
                    <PrimaryLink>Start your notebook</PrimaryLink>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background p-5 font-mono text-xs shadow-xs text-foreground">
                  <div className="border-b border-border pb-2 text-muted-foreground flex items-center justify-between">
                    <span>linear_algebra_notes.md</span>
                    <span className="text-[10px]">KaTeX Enabled</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    <p className="text-primary font-bold"># Eigenvalues & Eigenvectors</p>
                    <p className="text-muted-foreground font-sans">
                      A non-zero vector v is an eigenvector of matrix A with eigenvalue λ if:
                    </p>
                    <div className="rounded-lg bg-card border border-border p-2.5 text-center text-foreground font-sans text-sm">
                      A v = λ v ⟺ (A - λ I)v = 0
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "habits" && (
              <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    Module 05 · Habit Rituals & Streaks
                  </span>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl font-display">
                    Visible momentum that celebrates small efforts.
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                    Big achievements are simply daily rituals stacked over time. Remispace's habit
                    tracker offers visual completion heatmaps, streak shields, and intelligent
                    rescheduling so missing one day never derails your long-term consistency.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-foreground">
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-primary" /> Daily check-ins with reflection
                      prompts
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-primary" /> Streak preservation & gentle
                      reminders
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-primary" /> Weekly completion analytics &
                      insights
                    </li>
                  </ul>
                  <div className="mt-8">
                    <PrimaryLink>Track your habits</PrimaryLink>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background p-5 shadow-xs">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <span className="text-xs font-bold text-foreground">Today's Rituals</span>
                    <span className="text-xs font-semibold text-emerald-500">4 / 4 Completed</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between rounded-xl bg-card border border-border p-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="grid size-4 place-items-center rounded-full bg-emerald-500 text-white text-[9px] font-bold">
                          ✓
                        </span>
                        <span className="font-medium text-foreground">Read 30 mins technical paper</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">🔥 14 days</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-card border border-border p-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="grid size-4 place-items-center rounded-full bg-emerald-500 text-white text-[9px] font-bold">
                          ✓
                        </span>
                        <span className="font-medium text-foreground">Complete 1 Roadmap lesson</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">🔥 21 days</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-card border border-border p-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="grid size-4 place-items-center rounded-full bg-emerald-500 text-white text-[9px] font-bold">
                          ✓
                        </span>
                        <span className="font-medium text-foreground">Evening review & reflection</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">🔥 7 days</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* How it works 3-Step Journey */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-20">
        <SectionTitle
          center
          eyebrow="The Remispace Methodology"
          title="A quiet cadence for lasting knowledge."
          body="How ambitious ideas transform into accomplished milestones."
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Frame your ambition",
              desc: "Tell Remi what you want to master—from complex academic subjects to new technical frameworks. Remi structures the journey into clear phases.",
            },
            {
              step: "02",
              title: "Learn with contextual materials",
              desc: "Bring your textbooks, slide decks, or papers. Remi generates interactive lessons, mathematical breakdowns, and active recall practice.",
            },
            {
              step: "03",
              title: "Sustain steady momentum",
              desc: "Enter the ambient focus studio, preserve your daily habit streaks, and watch your knowledge compound week over week.",
            },
          ].map((item) => (
            <Reveal key={item.step} className="rounded-3xl border border-border bg-card p-8 shadow-xs">
              <span className="text-xs font-bold tracking-widest text-primary font-mono">
                {item.step}
              </span>
              <h3 className="mt-4 text-xl font-bold text-foreground font-display">{item.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Transparent Pricing Section */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20 border-t border-border/60">
        <SectionTitle
          center
          eyebrow="Simple, Honest Pricing"
          title="Invest in your focus and mastery."
          body="Start for free with generous daily limits. Upgrade to Pro for unlimited AI coach conversations and high-capacity document processing."
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {/* Free Tier */}
          <Reveal className="rounded-3xl border border-border bg-card p-8 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold text-foreground font-display">Free Trial</h3>
              <p className="mt-1 text-xs text-muted-foreground">For curious minds getting started</p>
              <div className="mt-5 flex items-baseline text-4xl font-extrabold text-foreground">
                ₹0<span className="ml-1 text-base font-normal text-muted-foreground">/ forever</span>
              </div>
              <ul className="mt-8 space-y-4 text-sm text-muted-foreground">
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-primary" /> 20 daily messages with Remi
                </li>
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-primary" /> 2 Active Study Roadmaps
                </li>
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-primary" /> 5 Notebooks & canvases
                </li>
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-primary" /> 15MB file upload limit
                </li>
              </ul>
            </div>
            <div className="mt-8">
              <Button asChild variant="outline" className="w-full rounded-2xl border-border">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Get Started Free
                </Link>
              </Button>
            </div>
          </Reveal>

          {/* Weekly Tier */}
          <Reveal className="relative rounded-3xl border-2 border-primary bg-card p-8 shadow-lift flex flex-col justify-between">
            <div className="absolute top-0 right-6 -translate-y-1/2 rounded-full bg-primary px-3.5 py-1 text-xs font-bold text-primary-foreground shadow-xs">
              Most Flexible
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground font-display">Weekly Pro</h3>
              <p className="mt-1 text-xs text-muted-foreground">For intensive study sprints & exams</p>
              <div className="mt-5 flex items-baseline text-4xl font-extrabold text-foreground">
                ₹99<span className="ml-1 text-base font-normal text-muted-foreground">/ week</span>
              </div>
              <ul className="mt-8 space-y-4 text-sm text-foreground">
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-primary" /> <strong>Unlimited</strong> messages with Remi
                </li>
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-primary" /> 10 Active Study Roadmaps
                </li>
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-primary" /> 15 Notebooks & canvases
                </li>
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-primary" /> 50MB file upload limit
                </li>
              </ul>
            </div>
            <div className="mt-8">
              <Button asChild className="w-full rounded-2xl press">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Upgrade with Razorpay
                </Link>
              </Button>
            </div>
          </Reveal>

          {/* Monthly Tier */}
          <Reveal className="rounded-3xl border border-border bg-card p-8 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold text-foreground font-display">Monthly Pro</h3>
              <p className="mt-1 text-xs text-muted-foreground">For dedicated lifelong learners</p>
              <div className="mt-5 flex items-baseline text-4xl font-extrabold text-foreground">
                ₹399<span className="ml-1 text-base font-normal text-muted-foreground">/ month</span>
              </div>
              <ul className="mt-8 space-y-4 text-sm text-muted-foreground">
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-primary" /> All Weekly Pro Features
                </li>
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-primary" /> Save ~10% compared to weekly
                </li>
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-primary" /> Highest priority response latency
                </li>
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-primary" /> Priority email support
                </li>
              </ul>
            </div>
            <div className="mt-8">
              <Button asChild variant="outline" className="w-full rounded-2xl border-border">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Subscribe Monthly
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>

        {/* Enterprise Banner */}
        <Reveal className="mt-12 rounded-3xl bg-primary p-8 text-primary-foreground max-w-5xl mx-auto shadow-lift">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold font-display">Institutions & Study Groups</h3>
              <p className="mt-1.5 text-sm text-primary-foreground/85">
                Need Bring Your Own Key (BYOK) support, custom rate limits, or volume team licensing?
              </p>
            </div>
            <Button
              asChild
              variant="secondary"
              className="rounded-2xl px-6 font-semibold shadow-xs whitespace-nowrap press"
            >
              <a href="mailto:aajprabhash@gmail.com?subject=Remispace Enterprise Inquiry">
                Contact Founder
              </a>
            </Button>
          </div>
        </Reveal>
      </section>

      {/* Call to Action Final Banner */}
      <section className="bg-primary/10 border-t border-border px-6 py-24 text-center">
        <Reveal>
          <span className="text-xs font-bold uppercase tracking-widest text-primary">Remispace</span>
          <h2 className="mx-auto mt-4 max-w-3xl text-balance text-4xl font-bold leading-tight tracking-tight md:text-5xl text-foreground font-display">
            You don't need to do everything today.
            <br />
            <span className="text-primary font-normal">You just need a quiet place to begin.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            Join students, researchers, and engineers building real learning momentum with Remispace.
          </p>
          <div className="mt-8">
            <PrimaryLink>Start your workspace today</PrimaryLink>
          </div>
        </Reveal>
      </section>

      {/* Classic Editorial Footer */}
      <footer className="border-t border-border bg-background px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <img src={remiLogo} alt="Remispace" className="size-7 rounded-xl object-cover" />
              <span className="font-display font-bold text-foreground text-lg">Remispace</span>
            </div>

            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#interactive-preview" className="hover:text-foreground transition-colors">
                Modules
              </a>
              <a href="#pricing" className="hover:text-foreground transition-colors">
                Pricing
              </a>
              <Link to="/auth" search={{ mode: "signin" }} className="hover:text-foreground transition-colors">
                Sign in
              </Link>
            </div>

            <p className="text-xs text-muted-foreground">
              © 2026 Remispace. Crafted for deep learning & focused thought.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
