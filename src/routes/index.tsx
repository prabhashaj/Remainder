import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, FileSearch, Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import remiLogo from "@/assets/remi.png";
import studyspaceImg from "@/assets/Studyspace.png";
import dashboardImg from "@/assets/Remispace_dashboard.png";
import roadmapsImg from "@/assets/roadmaps.png";
import tasksImg from "@/assets/tasks.png";
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
    "roadmaps" | "notebook" | "remi" | "study" | "habits" | "incontext"
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

      {/* Interactive Feature Showcase — 6 Core Features */}
      <section id="features" className="bg-[#02140d] border-y border-[#0d402e] px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <SectionTitle
            center
            eyebrow="What Remispace can do"
            title="Six tools. One calm workspace."
            body="Click each feature to see exactly how it looks and works — no marketing fluff, just the real product."
          />

          {/* Tab Strip */}
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {[
              { id: "roadmaps", label: "Roadmaps" },
              { id: "notebook",  label: "Notebook" },
              { id: "remi",      label: "Remi Agent" },
              { id: "study",     label: "Study Space" },
              { id: "habits",    label: "Habits · Goals · Tasks" },
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
              <div className="overflow-hidden rounded-3xl">
                <img
                  src={roadmapsImg}
                  alt="Remispace AI Learning Roadmaps"
                  className="w-full object-cover object-top"
                  loading="lazy"
                />
              </div>
            )}

            {/* ── Notebook ── */}
            {activeTab === "notebook" && (
              <div className="grid gap-0 lg:grid-cols-[1fr_1.4fr]">
                <div className="p-8 md:p-10 flex flex-col justify-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Feature 02 · Mathematical Canvas</span>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl font-display">
                    Block-based notes with live mathematical equation rendering.
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-zinc-300">
                    A calm, fluid editor that handles equations, syntax-highlighted code, nested subpages, and toggle lists effortlessly. Remi can generate entire notebooks from a single prompt.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-zinc-200">
                    <li className="flex items-center gap-2.5"><Check className="size-4.5 text-emerald-400" /> Instant mathematical formula &amp; equation formatting</li>
                    <li className="flex items-center gap-2.5"><Check className="size-4.5 text-emerald-400" /> 10+ handcrafted sensory color themes</li>
                    <li className="flex items-center gap-2.5"><Check className="size-4.5 text-emerald-400" /> AI-generated notebooks from any topic or PDF</li>
                  </ul>
                  <div className="mt-8"><PrimaryLink>Start your notebook</PrimaryLink></div>
                </div>
                <div className="bg-[#021810] border-l border-[#0d402e] p-6 font-mono text-xs text-white space-y-3">
                  <div className="border-b border-[#0d402e] pb-2 text-zinc-400 flex items-center justify-between">
                    <span>linear_algebra_notes.md</span>
                    <span className="text-[10px] text-emerald-400">Math Formulas Enabled</span>
                  </div>
                  <p className="text-emerald-400 font-bold text-sm"># Eigenvalues &amp; Eigenvectors</p>
                  <p className="text-zinc-300 font-sans text-sm leading-relaxed">A non-zero vector <strong>v</strong> is an eigenvector of matrix <strong>A</strong> with eigenvalue <strong>λ</strong> if:</p>
                  <div className="rounded-xl bg-[#05261b] border border-[#0d402e] p-3.5 text-center text-white font-sans text-base font-semibold">
                    A v = λ v &nbsp;⟺&nbsp; (A − λI)v = 0
                  </div>
                  <p className="text-zinc-300 font-sans text-sm leading-relaxed mt-1">To find eigenvalues, solve the <em>characteristic equation</em>:</p>
                  <div className="rounded-xl bg-[#05261b] border border-[#0d402e] p-3.5 text-center text-white font-sans text-base font-semibold">
                    det(A − λI) = 0
                  </div>
                  <div className="pt-2 flex items-center gap-2 text-[10px] text-zinc-500">
                    <span className="rounded bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 font-sans">Remi</span>
                    <span>Generated from CS50 Linear Algebra lecture notes</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Remi Agent ── */}
            {activeTab === "remi" && (
              <div className="overflow-hidden rounded-3xl">
                <img
                  src={dashboardImg}
                  alt="Remi AI Agent — Dashboard view"
                  className="w-full object-cover object-top"
                  loading="lazy"
                />
              </div>
            )}

            {/* ── Study Space ── */}
            {activeTab === "study" && (
              <div className="overflow-hidden rounded-3xl">
                <img
                  src={studyspaceImg}
                  alt="Remispace Study Space — distraction-free learning hub"
                  className="w-full object-cover object-top"
                  loading="lazy"
                />
              </div>
            )}

            {/* ── Habits · Goals · Tasks ── */}
            {activeTab === "habits" && (
              <div className="overflow-hidden rounded-3xl">
                <img
                  src={tasksImg}
                  alt="Remispace Habits, Goals, and Daily Tasks"
                  className="w-full object-cover object-top"
                  loading="lazy"
                />
              </div>
            )}

            {/* ── In-Context Learning ── */}
            {activeTab === "incontext" && (
              <div className="grid gap-0 lg:grid-cols-[1fr_1.4fr]">
                <div className="p-8 md:p-10 flex flex-col justify-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Feature 06 · Document Intelligence</span>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl font-display">
                    Chat with your PDFs, videos, and lecture slides.
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-zinc-300">
                    Upload any document and Remi learns from it instantly — summarize chapters, extract theorems, generate flashcards, and ask questions grounded in your exact material.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-zinc-200">
                    <li className="flex items-center gap-2.5"><Check className="size-4.5 text-emerald-400" /> Deep PDF reading with exact page citations</li>
                    <li className="flex items-center gap-2.5"><Check className="size-4.5 text-emerald-400" /> YouTube &amp; video transcript summarization</li>
                    <li className="flex items-center gap-2.5"><Check className="size-4.5 text-emerald-400" /> Active-recall flashcard generation from your content</li>
                  </ul>
                  <div className="mt-8"><PrimaryLink>Upload a document</PrimaryLink></div>
                </div>
                <div className="bg-[#021810] border-l border-[#0d402e] p-6 space-y-3">
                  <div className="flex items-center gap-2 border-b border-[#0d402e] pb-2.5">
                    <FileSearch className="size-3.5 text-emerald-400" />
                    <span className="text-xs font-bold text-white">attention_is_all_you_need.pdf</span>
                    <span className="ml-auto text-[10px] text-emerald-400 font-semibold">68 pages indexed</span>
                  </div>
                  <div className="rounded-xl bg-[#05261b] border border-[#0d402e] p-3.5">
                    <p className="text-[11px] text-zinc-400 font-semibold">You asked:</p>
                    <p className="mt-1 text-xs text-white">What is the core idea behind multi-head self-attention?</p>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3.5">
                    <p className="text-[11px] text-emerald-400 font-semibold">Remi · Page 4 citation</p>
                    <p className="mt-1 text-xs text-zinc-200 leading-relaxed">
                      Multi-head attention runs <em>h</em> parallel attention functions on different linear projections of Q, K, V — allowing the model to jointly attend to information from different representation subspaces.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button className="rounded-lg bg-[#05261b] border border-[#0d402e] px-3 py-1.5 text-[11px] text-zinc-300 font-medium">Generate flashcards</button>
                    <button className="rounded-lg bg-[#05261b] border border-[#0d402e] px-3 py-1.5 text-[11px] text-zinc-300 font-medium">Add to notebook</button>
                  </div>
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
