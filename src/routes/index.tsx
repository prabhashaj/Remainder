import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BookHeart,
  BookOpen,
  CalendarHeart,
  Check,
  ChevronRight,
  Compass,
  FileSearch,
  FileText,
  Focus,
  Menu,
  MessageSquareText,
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
/* Exact Study Place Workspace Showcase (Match User UI)                       */
/* -------------------------------------------------------------------------- */
function WorkspaceShowcase() {
  const reduced = useReducedMotion();
  const sidebarNav = [
    { label: "Dashboard", icon: BookHeart, active: false },
    { label: "Tasks", icon: Check, active: false },
    { label: "Habits", icon: CalendarHeart, active: false },
    { label: "Goals", icon: Compass, active: false },
    { label: "Roadmaps", icon: FileSearch, active: false },
    { label: "Documents", icon: FileText, active: false },
    { label: "Conversations", icon: MessageSquareText, hasChevron: true },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.8, delay: 0.18 }}
      className="relative mt-12 overflow-hidden rounded-3xl border border-[#0d402e] bg-[#021810] p-2.5 shadow-2xl backdrop-blur-xl md:p-4 text-left text-zinc-100 font-sans"
    >
      <div className="flex min-h-[560px] overflow-hidden rounded-2xl border border-[#0d402e] bg-[#031c13] text-zinc-100">
        {/* Left Sidebar */}
        <aside className="hidden w-[205px] shrink-0 border-r border-[#0d402e] bg-[#021810] p-4 md:flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <img src={remiLogo} alt="Remispace" className="size-6 rounded-lg object-cover" />
              <span className="font-display font-bold text-sm text-white">Remispace</span>
              <span className="rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-bold px-1.5 py-0.2 tracking-wider">
                PRO
              </span>
            </div>

            <div className="mt-6 space-y-1">
              {sidebarNav.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-xl px-2.5 py-1.8 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <item.icon className="size-3.5" />
                    <span>{item.label}</span>
                  </div>
                  {item.hasChevron && <ChevronRight className="size-3 text-zinc-500" />}
                </div>
              ))}
            </div>

            <div className="mt-7">
              <div className="flex items-center justify-between text-xs text-zinc-400 font-medium px-2.5">
                <span>Notebook</span>
                <span className="cursor-pointer hover:text-white">+</span>
              </div>
              <div className="mt-2 space-y-1 text-[11px] text-zinc-400">
                <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[#072a1e] truncate">
                  <span>📁</span>
                  <span className="truncate">CS50AI Lecture Notes: Int...</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[#072a1e] truncate">
                  <span>📁</span>
                  <span className="truncate">Backpropagation in Neur...</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-zinc-500 flex items-center gap-2 pt-4 border-t border-[#0d402e]">
            <span>⚙️ Settings</span>
          </div>
        </aside>

        {/* Main Viewport */}
        <div className="min-w-0 flex-1 p-5 md:p-8 flex flex-col justify-between bg-[#031e14]">
          <div>
            {/* Top Bar Header */}
            <div className="flex items-center justify-between border-b border-[#0d402e]/60 pb-4">
              <div className="flex items-center gap-3">
                <span className="cursor-pointer text-zinc-400">◫</span>
                <div className="flex items-center gap-2 rounded-full bg-[#06291d] border border-[#0d402e] px-3 py-1.5 text-xs text-zinc-400">
                  <FileSearch className="size-3 text-zinc-500" />
                  <span>Search</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-full bg-[#06291d] border border-[#0d402e] px-3 py-1 text-xs text-zinc-300">
                  <BookOpen className="size-3 text-emerald-400" />
                  <span>Study Place</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-[#06291d] border border-[#0d402e] px-3 py-1 text-xs text-zinc-300 font-mono">
                  <Focus className="size-3 text-emerald-400" />
                  <span>89:53</span>
                </div>
                <div className="grid size-7 place-items-center rounded-full bg-[#093828] border border-[#0d402e] text-xs font-bold text-emerald-400">
                  PR
                </div>
              </div>
            </div>

            {/* Active Study Banner Pills */}
            <div className="flex justify-end gap-2 mt-3 text-[11px]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#062b1e] border border-[#0d402e] px-3 py-1 text-zinc-300">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Introduction to Distribute... <strong className="font-mono">89:53</strong> ⏸ ✕
              </span>
              <span className="hidden sm:inline-flex items-center rounded-full bg-[#062b1e] border border-[#0d402e] px-3 py-1 text-zinc-400">
                Data Engineering to Data Scien...
              </span>
            </div>

            {/* Title & Description */}
            <div className="mt-4">
              <h3 className="text-2xl font-bold tracking-tight text-white font-display">
                Study Place
              </h3>
              <p className="mt-0.5 text-xs text-zinc-400">
                Everything for this session — and nothing else.
              </p>
            </div>

            {/* Main Stage Grid (UP NEXT & SESSION) */}
            <div className="mt-6 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
              {/* UP NEXT Left Card */}
              <div className="rounded-2xl border border-[#0d402e] bg-[#05261b] p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-emerald-400 tracking-wider uppercase">
                      UP NEXT
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Phase 1: Advanced Data Engineering Fundamentals (4-6 weeks)
                  </p>
                  <h4 className="mt-2 text-xl font-bold text-white font-display">
                    Introduction to Distributed Systems
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    Core concepts like CAP theorem, consistency models, and fault tolerance.
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-2.5">
                    <button className="rounded-full bg-emerald-500 px-4 py-1.8 text-xs font-semibold text-black shadow-sm hover:bg-emerald-400 transition-colors flex items-center gap-1.5">
                      <BookOpen className="size-3.5" /> Open lesson
                    </button>
                    <button className="rounded-full border border-[#0d402e] bg-[#062b1e] px-4 py-1.8 text-xs font-medium text-zinc-200 hover:bg-[#093828] transition-colors flex items-center gap-1.5">
                      <Focus className="size-3.5" /> Start focus
                    </button>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#0d402e]/60">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Subject progress</span>
                    <span>0/91 sub-topics</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#0a3324]">
                    <div className="h-full w-[2%] rounded-full bg-emerald-500" />
                  </div>
                </div>
              </div>

              {/* Right Column Cards */}
              <div className="space-y-4">
                {/* Session Timer Card */}
                <div className="rounded-2xl border border-[#0d402e] bg-[#05261b] p-5 shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    SESSION
                  </span>
                  <div className="mt-1 text-3xl font-extrabold tracking-tight text-white font-mono">
                    89:53
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-400 truncate">
                    Introduction to Distributed Systems
                  </p>
                  <div className="mt-3 flex gap-2">
                    {["15m", "25m", "45m"].map((dur) => (
                      <span
                        key={dur}
                        className="rounded-full bg-[#083022] border border-[#0d402e] px-2.5 py-0.5 text-[10px] font-medium text-zinc-300"
                      >
                        {dur}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Today's Tasks Card */}
                <div className="rounded-2xl border border-[#0d402e] bg-[#05261b] p-4 shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    TODAY'S TASKS
                  </span>
                  <p className="mt-2 text-xs text-zinc-400 flex items-center gap-1.5">
                    <Check className="size-3.5 text-emerald-400" /> All clear for today.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Roadmaps Section */}
            <div className="mt-6">
              <p className="text-xs font-bold text-white">Your roadmaps</p>
              <p className="text-[11px] text-zinc-400">
                Expand to browse phases, topics and read lessons inline.
              </p>

              <div className="mt-2.5 rounded-2xl border border-[#0d402e] bg-[#05261b] p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-xs font-medium text-zinc-200">
                  <BookOpen className="size-4 text-emerald-400" />
                  <span>Data Engineering to Data Science: Intermediate Roadmap</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-zinc-400">0/91</span>
                  <ChevronRight className="size-4 text-zinc-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
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
      body: "A clean, beautiful canvas with instant mathematical equation rendering, code blocks, toggleable callouts, and handcrafted color themes.",
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
    <main className="min-h-screen bg-[#021810] text-[#f4f4f5] selection:bg-emerald-500/30 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#0d402e]/80 bg-[#021810]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <img
              src={remiLogo}
              alt="Remispace logo"
              width={34}
              height={34}
              className="size-8.5 rounded-xl object-cover shadow-xs"
            />
            <span className="font-display text-xl font-bold tracking-tight text-white">
              Remispace
            </span>
          </div>

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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#052b1e] px-4 py-1.5 text-xs font-bold text-emerald-400 border border-[#0d402e]">
            <Sparkles className="size-3.5 text-emerald-400" /> A calm sanctuary for deep learning
          </span>

          <h1 className="mx-auto mt-6 max-w-4xl text-balance text-5xl font-bold leading-[1.08] tracking-tight md:text-6xl lg:text-7xl text-white font-display">
            The thoughtful workspace for everything you're learning.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-emerald-100/70 md:text-xl">
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

      {/* 6 Core Feature Pillars */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20 border-t border-[#0d402e]/60">
        <SectionTitle
          eyebrow="Crafted for deep thinking"
          title="Everything you need to master complex subjects."
          body="Traditional note apps are passive containers. Generic AI chatbots lose your context. Remispace unites structure, materials, and coaching into one harmonious rhythm."
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Reveal
              key={f.title}
              className="group rounded-3xl border border-[#0d402e] bg-[#042419] p-7 shadow-lg transition hover:-translate-y-1 hover:border-emerald-500/40 hover:bg-[#062f21]"
            >
              <div className="grid size-11 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400 transition-colors group-hover:bg-emerald-500 group-hover:text-black">
                <f.icon className="size-5.5" />
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-white">{f.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">{f.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Interactive Feature Deep Dive (Tabbed Showcase) */}
      <section id="interactive-preview" className="bg-[#02140d] border-y border-[#0d402e] px-6 py-20">
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
              { id: "notes", label: "Notes & Math Formulas", icon: BookOpen },
              { id: "habits", label: "Habits & Rituals", icon: CalendarHeart },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as typeof activeTab)}
                className={`press flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-all ${
                  activeTab === t.id
                    ? "bg-emerald-500 text-black shadow-lg font-bold"
                    : "bg-[#042419] border border-[#0d402e] text-zinc-400 hover:text-white hover:bg-[#062f21]"
                }`}
              >
                <t.icon className="size-4" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content Display */}
          <Reveal className="mt-8 overflow-hidden rounded-3xl border border-[#0d402e] bg-[#042419] p-6 md:p-10 shadow-2xl">
            {activeTab === "roadmaps" && (
              <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Module 01 · Structured Mastery
                  </span>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl font-display">
                    Transform any subject into a step-by-step curriculum.
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-zinc-300">
                    Whether you're preparing for technical interviews, learning machine learning, or
                    studying history, Remi decomposes the syllabus into phases, milestones, and
                    actionable daily lessons that prevent overwhelm.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-zinc-200">
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400" /> Automatic checkpoint & quiz
                      generation
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400" /> Adaptive pacing based on your
                      learning speed
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400" /> Directly connected to your daily
                      task list
                    </li>
                  </ul>
                  <div className="mt-8">
                    <PrimaryLink>Build your first roadmap</PrimaryLink>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#0d402e] bg-[#021810] p-5 shadow-xs">
                  <div className="flex items-center justify-between border-b border-[#0d402e] pb-3">
                    <span className="text-xs font-bold text-white">Curriculum Preview</span>
                    <span className="text-[11px] text-emerald-400 font-semibold">Phase 1 / 4 Complete</span>
                  </div>
                  <div className="mt-4 space-y-2.5">
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-white flex items-center justify-between">
                      <span>✓ 1. Mathematical Foundations & Linear Algebra</span>
                      <span className="text-[10px] text-emerald-400 font-bold uppercase">Passed</span>
                    </div>
                    <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/20 p-3 text-xs font-semibold text-emerald-300 flex items-center justify-between">
                      <span>→ 2. Loss Functions & Gradient Descent Optimization</span>
                      <span className="text-[10px] bg-emerald-500 text-black px-2 py-0.5 rounded-md font-bold">
                        Active
                      </span>
                    </div>
                    <div className="rounded-xl border border-[#0d402e] bg-[#05261b] p-3 text-xs font-medium text-zinc-400 flex items-center justify-between">
                      <span>3. Neural Network Backpropagation from Scratch</span>
                      <span className="text-[10px] text-zinc-500">Upcoming</span>
                    </div>
                    <div className="rounded-xl border border-[#0d402e] bg-[#05261b] p-3 text-xs font-medium text-zinc-400 flex items-center justify-between">
                      <span>4. Transformers & Multi-Head Self Attention</span>
                      <span className="text-[10px] text-zinc-500">Upcoming</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "documents" && (
              <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Module 02 · Deep Document Research
                  </span>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl font-display">
                    Interactive PDF reader with theorem extraction.
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-zinc-300">
                    Upload textbooks, lecture slide decks, and dense academic papers. Remi indexes
                    your materials, allowing you to ask questions with exact page references,
                    generate pre-reading briefs, and extract formulas into your notes.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-zinc-200">
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400" /> Instant document synthesis &
                      chapter summaries
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400" /> Page-by-page citations with inline
                      snippets
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400" /> 1-click flashcard deck generation
                    </li>
                  </ul>
                  <div className="mt-8">
                    <PrimaryLink>Try Document AI</PrimaryLink>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#0d402e] bg-[#021810] p-5 shadow-xs">
                  <div className="flex items-center gap-2 border-b border-[#0d402e] pb-3">
                    <FileText className="size-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white truncate">
                      Paper: Deep Residual Learning for Image Recognition.pdf
                    </span>
                  </div>
                  <div className="mt-4 rounded-xl bg-[#05261b] border border-[#0d402e] p-3 text-xs leading-relaxed text-zinc-300">
                    <span className="font-semibold text-white">Key Concept Extracted:</span>
                    "Residual mapping allows layers to fit residual functions instead of unreferenced ones, preventing the degradation problem in deep networks."
                  </div>
                  <div className="mt-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-300 font-medium">
                    💡 Remi generated 8 review flashcards for this section.
                  </div>
                </div>
              </div>
            )}

            {activeTab === "focus" && (
              <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Module 03 · Ambient Focus Studio
                  </span>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl font-display">
                    Distraction-free flow state for deep work.
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-zinc-300">
                    Silence the noise of the internet. The Focus Studio provides customizable
                    Pomodoro intervals, real-time local weather updates, calming background audio,
                    and end-of-session reflection logs.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-zinc-200">
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400" /> Fullscreen deep work mode with
                      countdown
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400" /> Ambient soundscapes: Rain, Coffee
                      Shop, Forest, White Noise
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400" /> Live weather integration & gentle
                      breaks
                    </li>
                  </ul>
                  <div className="mt-8">
                    <PrimaryLink>Open Focus Studio</PrimaryLink>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#0d402e] bg-[#021810] p-6 text-center shadow-xs">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    POMODORO INTERVAL
                  </span>
                  <div className="mt-3 text-5xl font-extrabold tracking-tight text-white font-mono">
                    25:00
                  </div>
                  <p className="mt-2 text-xs text-emerald-400 font-semibold">
                    Rainy Afternoon · 22°C Overcast
                  </p>
                  <div className="mt-6 flex justify-center gap-3">
                    <button className="rounded-xl bg-emerald-500 px-6 py-2.5 text-xs font-bold text-black shadow-lg press flex items-center gap-1.5">
                      <Play className="size-3.5 fill-current" /> Start Focus
                    </button>
                    <button className="rounded-xl border border-[#0d402e] bg-[#062b1e] px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-[#093828] transition-colors flex items-center gap-1.5">
                      <Music className="size-3.5" /> Ambient Audio
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "notes" && (
              <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Module 04 · Mathematical Canvas
                  </span>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl font-display">
                    Block-based notebook with crystal-clear mathematical equation rendering.
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-zinc-300">
                    A calm, fluid text editor that handles equations, syntax-highlighted code,
                    nested subpages, and interactive toggle lists effortlessly. Never compromise
                    between beauty and technical rigor.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-zinc-200">
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400" /> Instant mathematical formulas & equation formatting
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400" /> 10+ handcrafted sensory color
                      themes
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400" /> Seamless inline Remi assistant
                      prompts
                    </li>
                  </ul>
                  <div className="mt-8">
                    <PrimaryLink>Start your notebook</PrimaryLink>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#0d402e] bg-[#021810] p-5 font-mono text-xs shadow-xs text-white">
                  <div className="border-b border-[#0d402e] pb-2 text-zinc-400 flex items-center justify-between">
                    <span>linear_algebra_notes.md</span>
                    <span className="text-[10px] text-emerald-400">Math Formulas Enabled</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    <p className="text-emerald-400 font-bold"># Eigenvalues & Eigenvectors</p>
                    <p className="text-zinc-300 font-sans">
                      A non-zero vector v is an eigenvector of matrix A with eigenvalue λ if:
                    </p>
                    <div className="rounded-lg bg-[#05261b] border border-[#0d402e] p-2.5 text-center text-white font-sans text-sm">
                      A v = λ v ⟺ (A - λ I)v = 0
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "habits" && (
              <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Module 05 · Habit Rituals & Streaks
                  </span>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl font-display">
                    Visible momentum that celebrates small efforts.
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-zinc-300">
                    Big achievements are simply daily rituals stacked over time. Remispace's habit
                    tracker offers visual completion heatmaps, streak shields, and intelligent
                    rescheduling so missing one day never derails your long-term consistency.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-zinc-200">
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400" /> Daily check-ins with reflection
                      prompts
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400" /> Streak preservation & gentle
                      reminders
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-4.5 text-emerald-400" /> Weekly completion analytics &
                      insights
                    </li>
                  </ul>
                  <div className="mt-8">
                    <PrimaryLink>Track your habits</PrimaryLink>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#0d402e] bg-[#021810] p-5 shadow-xs">
                  <div className="flex items-center justify-between border-b border-[#0d402e] pb-3">
                    <span className="text-xs font-bold text-white">Today's Rituals</span>
                    <span className="text-xs font-semibold text-emerald-400">4 / 4 Completed</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between rounded-xl bg-[#05261b] border border-[#0d402e] p-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="grid size-4 place-items-center rounded-full bg-emerald-500 text-black text-[9px] font-bold">
                          ✓
                        </span>
                        <span className="font-medium text-white">Read 30 mins technical paper</span>
                      </div>
                      <span className="text-[11px] text-zinc-400">🔥 14 days</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-[#05261b] border border-[#0d402e] p-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="grid size-4 place-items-center rounded-full bg-emerald-500 text-black text-[9px] font-bold">
                          ✓
                        </span>
                        <span className="font-medium text-white">Complete 1 Roadmap lesson</span>
                      </div>
                      <span className="text-[11px] text-zinc-400">🔥 21 days</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-[#05261b] border border-[#0d402e] p-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="grid size-4 place-items-center rounded-full bg-emerald-500 text-black text-[9px] font-bold">
                          ✓
                        </span>
                        <span className="font-medium text-white">Evening review & reflection</span>
                      </div>
                      <span className="text-[11px] text-zinc-400">🔥 7 days</span>
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
            <div className="flex items-center gap-3">
              <img src={remiLogo} alt="Remispace" className="size-7 rounded-xl object-cover" />
              <span className="font-display font-bold text-white text-lg">Remispace</span>
            </div>

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
