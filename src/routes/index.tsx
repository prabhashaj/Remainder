import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { RemispaceBrand } from "@/components/brand";
import studyspaceImg from "@/assets/Studyspace.png";
import roadmapsImg from "@/assets/roadmaps.png";
import tasksImg from "@/assets/tasks.png";
import remichatImg from "@/assets/remichat.png";
import notebookImg from "@/assets/Notebbok.png";
import incontextImg from "@/assets/Incontextlearning.png";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Remispace — A quiet sanctuary for deep learning & structured roadmaps" },
      {
        name: "description",
        content:
          "A calm sanctuary designed for deep thinkers. Master complex subjects with structured roadmaps, mathematical notebooks, document intelligence, and Remi—your dedicated AI companion for lasting momentum.",
      },
      {
        property: "og:title",
        content: "Remispace — A quiet sanctuary for deep learning & structured roadmaps",
      },
      {
        property: "og:description",
        content:
          "A calm sanctuary designed for deep thinkers. Master complex subjects with structured roadmaps, mathematical notebooks, document intelligence, and Remi—your dedicated AI companion for lasting momentum.",
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
      className={`group inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-black shadow-lg shadow-emerald-500/10 transition-all hover:bg-emerald-400 hover:-translate-y-0.5 press ${className}`}
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
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-emerald-400">
          {eyebrow}
        </p>
      )}
      <h2
        className={`text-balance text-4xl font-bold leading-[1.15] tracking-tight md:text-5xl font-display ${
          inverse ? "text-white" : "text-white"
        }`}
      >
        {title}
      </h2>
      {body && (
        <p className="mt-4 text-pretty text-base leading-relaxed md:text-lg text-emerald-100/70">
          {body}
        </p>
      )}
    </Reveal>
  );
}

/* -------------------------------------------------------------------------- */
/* Workspace Screenshot Showcase                                              */
/* -------------------------------------------------------------------------- */
function WorkspaceShowcase() {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.8, delay: 0.18 }}
      className="relative mt-12 overflow-hidden rounded-3xl shadow-2xl"
    >
      <img
        src={studyspaceImg}
        alt="Remispace workspace — Dashboard with Remi AI assistant"
        className="w-full object-cover object-top"
        loading="lazy"
      />
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Landing Component (Fixed Pure Dark Green Palette)                    */
/* -------------------------------------------------------------------------- */
export default function Landing() {
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "roadmaps" | "notebook" | "remi" | "study" | "goals" | "incontext"
  >("roadmaps");

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/dashboard", replace: true });
      }
    });
  }, [navigate]);



  return (
    <main className="min-h-screen bg-[#021810] text-[#f4f4f5] selection:bg-emerald-500/30 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#0d402e]/80 bg-[#021810]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <RemispaceBrand size="md" className="text-white" />
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-emerald-100/70 md:flex">
            <a href="#features" className="transition-colors hover:text-white">
              Features
            </a>
            <a href="#interactive-preview" className="transition-colors hover:text-white">
              Explore
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-white">
              How it works
            </a>
            <a href="#pricing" className="transition-colors hover:text-white">
              Pricing
            </a>
          </nav>

          <div className="hidden items-center gap-2.5 md:flex">
            <Button
              asChild
              variant="ghost"
              className="rounded-2xl font-medium text-zinc-300 hover:text-white hover:bg-[#062b1e]"
            >
              <Link to="/auth" search={{ mode: "signin" }}>
                Sign in
              </Link>
            </Button>
            <Button
              asChild
              className="rounded-2xl px-5 font-bold bg-emerald-500 text-black hover:bg-emerald-400 press shadow-sm"
            >
              <Link to="/auth" search={{ mode: "signup" }}>
                Start for free
              </Link>
            </Button>
          </div>

          <button
            type="button"
            aria-label="Toggle navigation"
            onClick={() => setMenu(!menu)}
            className="grid size-9 place-items-center rounded-xl bg-[#062b1e] text-zinc-300 md:hidden border border-[#0d402e]"
          >
            {menu ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>

        {menu && (
          <div className="border-t border-[#0d402e] bg-[#021810] px-6 py-5 md:hidden">
            <nav className="grid gap-4 text-sm font-medium">
              <a href="#features" onClick={() => setMenu(false)} className="text-zinc-300">
                Features
              </a>
              <a href="#interactive-preview" onClick={() => setMenu(false)} className="text-zinc-300">
                Explore
              </a>
              <a href="#how-it-works" onClick={() => setMenu(false)} className="text-zinc-300">
                How it works
              </a>
              <a href="#pricing" onClick={() => setMenu(false)} className="text-zinc-300">
                Pricing
              </a>
              <Button asChild className="rounded-2xl w-full bg-emerald-500 text-black font-bold">
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
          <h1 className="mx-auto max-w-4xl text-balance text-5xl font-bold leading-[1.08] tracking-tight md:text-6xl lg:text-7xl text-white font-display">
            The thoughtful workspace for everything you're learning.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-emerald-100/70 md:text-xl">
            A calm sanctuary designed for deep thinkers. Master complex subjects with structured
            roadmaps, mathematical notebooks, document intelligence, and Remi—your dedicated AI
            companion for lasting momentum.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <PrimaryLink>Start your learning workspace</PrimaryLink>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-2xl px-7 font-medium press border-[#0d402e] bg-[#05261b] text-zinc-200 hover:bg-[#083626] hover:text-white"
            >
              <Link to="/auth" search={{ mode: "signin" }}>
                Sign in to existing
              </Link>
            </Button>
          </div>

          <p className="mt-4 text-xs text-zinc-400">
            Free forever tier · No credit card required · Instant setup
          </p>
        </Reveal>

        {/* Main Workspace Showcase */}
        <WorkspaceShowcase />
      </section>

      {/* Interactive Feature Showcase */}
      <section id="features" className="bg-[#02140d] border-y border-[#0d402e] px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <SectionTitle
            center
            eyebrow="Crafted for deep mastery"
            title="Everything you need to master complex subjects."
            body="Explore the core environments designed to help you absorb, structure, and retain knowledge across disciplines."
          />

          {/* Tab Strip */}
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {[
              { id: "roadmaps", label: "Roadmaps & Streaks" },
              { id: "notebook",  label: "Notebooks" },
              { id: "remi",      label: "Remi Agent" },
              { id: "study",     label: "Study Space" },
              { id: "goals",     label: "Goals · Tasks · Focus" },
              { id: "incontext", label: "In-Context Learning" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as typeof activeTab)}
                className={`press rounded-2xl px-5 py-2.5 text-sm font-semibold transition-all ${
                  activeTab === t.id
                    ? "bg-emerald-500 text-black shadow-lg font-bold"
                    : "bg-[#042419] border border-[#0d402e] text-zinc-400 hover:text-white hover:bg-[#062f21]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Showcase Panel */}
          <div className="mt-8 overflow-hidden rounded-3xl border border-[#0d402e] bg-[#042419] shadow-2xl">
            {/* ── Roadmaps ── */}
            {activeTab === "roadmaps" && (
              <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1fr_1.3fr] lg:items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Structured Mastery
                  </span>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl font-display">
                    Deconstruct any subject into clear learning phases.
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-zinc-300">
                    Transform ambitious goals into step-by-step curricula with milestone checkpoints, adaptive lesson plans, and active recall quizzes that prevent cognitive overload.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-zinc-200">
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400 shrink-0" />
                      <span>Multi-phase structured curricula tailored to your ambition</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400 shrink-0" />
                      <span>Automatic checkpoint validations and progress tracking</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400 shrink-0" />
                      <span>Direct connection to daily study sessions and focus timers</span>
                    </li>
                  </ul>
                  <div className="mt-8">
                    <PrimaryLink>Build your roadmap</PrimaryLink>
                  </div>
                </div>
                <div className="overflow-hidden rounded-2xl border border-[#0d402e] bg-[#021810] shadow-xl">
                  <img
                    src={roadmapsImg}
                    alt="Remispace AI Learning Roadmaps"
                    className="w-full object-cover object-top"
                    loading="lazy"
                  />
                </div>
              </div>
            )}

            {/* ── Notebooks ── */}
            {activeTab === "notebook" && (
              <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1fr_1.3fr] lg:items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Mathematical Canvas
                  </span>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl font-display">
                    Fluid block-based notes with live mathematical formulas.
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-zinc-300">
                    A distraction-free writing environment that effortlessly formats equations, syntax-highlighted code blocks, toggleable sections, and AI-generated outlines.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-zinc-200">
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400 shrink-0" />
                      <span>Instant mathematical equation & formula typography</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400 shrink-0" />
                      <span>Sensory color themes with toggle lists and callout blocks</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400 shrink-0" />
                      <span>1-click note generation from study materials and lectures</span>
                    </li>
                  </ul>
                  <div className="mt-8">
                    <PrimaryLink>Start your notebook</PrimaryLink>
                  </div>
                </div>
                <div className="overflow-hidden rounded-2xl border border-[#0d402e] bg-[#021810] shadow-xl">
                  <img
                    src={notebookImg}
                    alt="Remispace Notebooks — Mathematical canvas"
                    className="w-full object-cover object-top"
                    loading="lazy"
                  />
                </div>
              </div>
            )}

            {/* ── Remi Agent ── */}
            {activeTab === "remi" && (
              <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1fr_1.3fr] lg:items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Autonomous Learning Companion
                  </span>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl font-display">
                    An AI coach with persistent memory across every session.
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-zinc-300">
                    Remi doesn't just answer questions—it remembers your learning pace, suggests your next best action, creates tasks, and guides you through difficult concepts step by step.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-zinc-200">
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400 shrink-0" />
                      <span>Persistent memory of your past queries, roadmaps, and goals</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400 shrink-0" />
                      <span>Autonomous tool use to create notebooks, roadmaps, and tasks</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400 shrink-0" />
                      <span>Socratic explanations tailored to your exact level of understanding</span>
                    </li>
                  </ul>
                  <div className="mt-8">
                    <PrimaryLink>Talk to Remi</PrimaryLink>
                  </div>
                </div>
                <div className="overflow-hidden rounded-2xl border border-[#0d402e] bg-[#021810] shadow-xl">
                  <img
                    src={remichatImg}
                    alt="Chat with Remi — AI learning assistant"
                    className="w-full object-cover object-top"
                    loading="lazy"
                  />
                </div>
              </div>
            )}

            {/* ── Study Space ── */}
            {activeTab === "study" && (
              <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1fr_1.3fr] lg:items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Unified Study Sanctuary
                  </span>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl font-display">
                    All your materials, notes, and coaching in one view.
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-zinc-300">
                    Enter a calm, focused environment where your open notebook, current roadmap milestone, and Remi AI coach sit side by side without messy browser tabs.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-zinc-200">
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400 shrink-0" />
                      <span>Seamless split-screen reading, note-taking, and AI dialog</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400 shrink-0" />
                      <span>Integrated focus timer with ambient soundscapes and session logs</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400 shrink-0" />
                      <span>Zero context switching between thinking, reading, and writing</span>
                    </li>
                  </ul>
                  <div className="mt-8">
                    <PrimaryLink>Open Study Space</PrimaryLink>
                  </div>
                </div>
                <div className="overflow-hidden rounded-2xl border border-[#0d402e] bg-[#021810] shadow-xl">
                  <img
                    src={studyspaceImg}
                    alt="Remispace Study Space — distraction-free learning hub"
                    className="w-full object-cover object-top"
                    loading="lazy"
                  />
                </div>
              </div>
            )}

            {/* ── Goals · Tasks · Focus ── */}
            {activeTab === "goals" && (
              <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1fr_1.3fr] lg:items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Goal & Task Momentum
                  </span>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl font-display">
                    Sustain steady daily progress without burnout.
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-zinc-300">
                    Connect daily tasks directly to high-level goals. Track roadmap study streaks, intelligent rescheduling, and gentle momentum protection.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-zinc-200">
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400 shrink-0" />
                      <span>Roadmap study streaks and milestone momentum</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400 shrink-0" />
                      <span>Milestone tracking tied directly to your learning roadmaps</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400 shrink-0" />
                      <span>Actionable daily task priorities derived from your study rhythm</span>
                    </li>
                  </ul>
                  <div className="mt-8">
                    <PrimaryLink>Start your journey</PrimaryLink>
                  </div>
                </div>
                <div className="overflow-hidden rounded-2xl border border-[#0d402e] bg-[#021810] shadow-xl">
                  <img
                    src={tasksImg}
                    alt="Remispace Goals and Daily Tasks"
                    className="w-full object-cover object-top"
                    loading="lazy"
                  />
                </div>
              </div>
            )}

            {/* ── In-Context Learning ── */}
            {activeTab === "incontext" && (
              <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1fr_1.3fr] lg:items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Document Intelligence
                  </span>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl font-display">
                    Chat deeply with textbooks, papers, and lecture slides.
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-zinc-300">
                    Upload PDFs, lecture slides, or video links. Remi extracts core theorems, generates flashcards, and provides answers grounded in page-by-page citations.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-zinc-200">
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400 shrink-0" />
                      <span>Deep PDF comprehension with exact page references and quotes</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400 shrink-0" />
                      <span>Automatic flashcard generation for spaced repetition reviews</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400 shrink-0" />
                      <span>Multi-modal synthesis across lecture notes, slides, and papers</span>
                    </li>
                  </ul>
                  <div className="mt-8">
                    <PrimaryLink>Upload a document</PrimaryLink>
                  </div>
                </div>
                <div className="overflow-hidden rounded-2xl border border-[#0d402e] bg-[#021810] shadow-xl">
                  <img
                    src={incontextImg}
                    alt="Remispace In-Context Learning — Document intelligence"
                    className="w-full object-cover object-top"
                    loading="lazy"
                  />
                </div>
              </div>
            )}
          </div>
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
              desc: "Enter the ambient focus studio, preserve your study streaks, and watch your knowledge compound week over week.",
            },
          ].map((item) => (
            <Reveal
              key={item.step}
              className="rounded-3xl border border-[#0d402e] bg-[#042419] p-8 shadow-xs hover:border-emerald-500/40 transition-colors"
            >
              <span className="text-xs font-bold tracking-widest text-emerald-400 font-mono">
                {item.step}
              </span>
              <h3 className="mt-4 text-xl font-bold text-white font-display">{item.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">{item.desc}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Transparent Pricing Section */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20 border-t border-[#0d402e]/60">
        <SectionTitle
          center
          eyebrow="Simple, Honest Pricing"
          title="Invest in your focus and mastery."
          body="Start for free with generous daily limits. Upgrade to Pro for unlimited AI coach conversations and high-capacity document processing."
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {/* Free Tier */}
          <Reveal className="rounded-3xl border border-[#0d402e] bg-[#042419] p-8 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold text-white font-display">Free Trial</h3>
              <p className="mt-1 text-xs text-zinc-400">For curious minds getting started</p>
              <div className="mt-5 flex items-baseline text-4xl font-extrabold text-white">
                ₹0<span className="ml-1 text-base font-normal text-zinc-400">/ forever</span>
              </div>
              <ul className="mt-8 space-y-4 text-sm text-zinc-300">
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-emerald-400" /> 20 daily messages with Remi
                </li>
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-emerald-400" /> 2 Active Study Roadmaps
                </li>
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-emerald-400" /> 5 Notebooks & canvases
                </li>
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-emerald-400" /> 15MB file upload limit
                </li>
              </ul>
            </div>
            <div className="mt-8">
              <Button
                asChild
                variant="outline"
                className="w-full rounded-2xl border-[#0d402e] bg-[#062b1e] text-zinc-200 hover:bg-[#093828] hover:text-white"
              >
                <Link to="/auth" search={{ mode: "signup" }}>
                  Get Started Free
                </Link>
              </Button>
            </div>
          </Reveal>

          {/* Weekly Tier */}
          <Reveal className="relative rounded-3xl border-2 border-emerald-500 bg-[#062f21] p-8 shadow-2xl flex flex-col justify-between">
            <div className="absolute top-0 right-6 -translate-y-1/2 rounded-full bg-emerald-500 px-3.5 py-1 text-xs font-bold text-black shadow-xs">
              Most Flexible
            </div>
            <div>
              <h3 className="text-xl font-bold text-white font-display">Weekly Pro</h3>
              <p className="mt-1 text-xs text-zinc-300">For intensive study sprints & exams</p>
              <div className="mt-5 flex items-baseline text-4xl font-extrabold text-white">
                ₹99<span className="ml-1 text-base font-normal text-zinc-300">/ week</span>
              </div>
              <ul className="mt-8 space-y-4 text-sm text-zinc-100">
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-emerald-400" /> <strong>Unlimited</strong> messages with Remi
                </li>
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-emerald-400" /> 10 Active Study Roadmaps
                </li>
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-emerald-400" /> 15 Notebooks & canvases
                </li>
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-emerald-400" /> 50MB file upload limit
                </li>
              </ul>
            </div>
            <div className="mt-8">
              <Button asChild className="w-full rounded-2xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 press">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Upgrade to Weekly Pro
                </Link>
              </Button>
            </div>
          </Reveal>

          {/* Monthly Tier */}
          <Reveal className="rounded-3xl border border-[#0d402e] bg-[#042419] p-8 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold text-white font-display">Monthly Pro</h3>
              <p className="mt-1 text-xs text-zinc-400">For dedicated lifelong learners</p>
              <div className="mt-5 flex items-baseline text-4xl font-extrabold text-white">
                ₹399<span className="ml-1 text-base font-normal text-zinc-400">/ month</span>
              </div>
              <ul className="mt-8 space-y-4 text-sm text-zinc-300">
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-emerald-400" /> All Weekly Pro Features
                </li>
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-emerald-400" /> Save ~10% compared to weekly
                </li>
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-emerald-400" /> Highest priority response latency
                </li>
                <li className="flex items-center gap-3">
                  <Check className="size-4 text-emerald-400" /> Priority email support
                </li>
              </ul>
            </div>
            <div className="mt-8">
              <Button
                asChild
                variant="outline"
                className="w-full rounded-2xl border-[#0d402e] bg-[#062b1e] text-zinc-200 hover:bg-[#093828] hover:text-white"
              >
                <Link to="/auth" search={{ mode: "signup" }}>
                  Subscribe Monthly
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>

        {/* Enterprise Banner */}
        <Reveal className="mt-12 rounded-3xl bg-gradient-to-r from-[#073826] to-[#0a4831] border border-emerald-500/30 p-8 text-white max-w-5xl mx-auto shadow-2xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold font-display">Institutions & Study Groups</h3>
              <p className="mt-1.5 text-sm text-emerald-100/80">
                Need Bring Your Own Key (BYOK) support, custom rate limits, or volume team licensing?
              </p>
            </div>
            <Button
              asChild
              className="rounded-2xl px-6 font-bold bg-white text-black hover:bg-zinc-100 shadow-xs whitespace-nowrap press"
            >
              <a href="mailto:aajprabhash@gmail.com?subject=Remispace Enterprise Inquiry">
                Contact Founder
              </a>
            </Button>
          </div>
        </Reveal>
      </section>

      {/* Call to Action Final Banner */}
      <section className="bg-[#02140d] border-t border-[#0d402e] px-6 py-24 text-center">
        <Reveal>
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Remispace</span>
          <h2 className="mx-auto mt-4 max-w-3xl text-balance text-4xl font-bold leading-tight tracking-tight md:text-5xl text-white font-display">
            You don't need to do everything today.
            <br />
            <span className="text-emerald-400 font-normal">You just need a quiet place to begin.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-zinc-300">
            Join students, researchers, and engineers building real learning momentum with Remispace.
          </p>
          <div className="mt-8">
            <PrimaryLink>Start your workspace today</PrimaryLink>
          </div>
        </Reveal>
      </section>

      {/* Classic Editorial Footer */}
      <footer className="border-t border-[#0d402e] bg-[#021810] px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
            <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <RemispaceBrand size="md" className="text-white" />
            </Link>

            <div className="flex flex-wrap gap-6 text-sm text-zinc-400">
              <a href="#features" className="hover:text-white transition-colors">
                Features
              </a>
              <a href="#interactive-preview" className="hover:text-white transition-colors">
                Modules
              </a>
              <a href="#pricing" className="hover:text-white transition-colors">
                Pricing
              </a>
              <Link to="/auth" search={{ mode: "signin" }} className="hover:text-white transition-colors">
                Sign in
              </Link>
            </div>

            <p className="text-xs text-zinc-500">
              © 2026 Remispace. Crafted for deep learning & focused thought.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
