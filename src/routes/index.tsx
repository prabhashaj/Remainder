import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import {
  Sparkles,
  ArrowRight,
  Search,
  Brain,
  BookOpen,
  GraduationCap,
  Zap,
  Globe,
  MessageSquare,
  Star,
  Shield,
  Target,
  Lightbulb,
  CheckCircle2,
  Image as ImageIcon,
  FileText,
  Upload,
  BarChart3,
  Layers,
  MousePointerClick,
  ChevronDown,
  Presentation,
  Mic,
  Play,
  Volume2,
  Camera,
  Compass,
  Code2,
  HelpCircle,
} from "lucide-react";

import { RemispaceBrand } from "@/components/brand";
import remispaceDashboardImg from "@/assets/Remispace_dashboard.png";
import studyspaceImg from "@/assets/Studyspace.png";
import topicLessonScrollImg from "@/assets/topic-lesson-scroll.png";
import roadmapScrollImg from "@/assets/roadmap-scroll.png";
import roadmapsImg from "@/assets/roadmaps.png";
import tasksImg from "@/assets/tasks.png";
import remichatImg from "@/assets/remichat.png";
import notebookImg from "@/assets/Notebbok.png";
import incontextImg from "@/assets/Incontextlearning.png";
import heroStudyImg from "@/assets/hero-study.png";
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
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/dashboard", replace: true });
      }
    });
  }, [navigate]);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => new Set([...prev, entry.target.id]));
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    sectionRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const addRef = (id: string) => (el: HTMLElement | null) => {
    if (el) sectionRefs.current.set(id, el);
  };

  const isVisible = (id: string) => visibleSections.has(id);

  const features = [
    {
      icon: Search,
      label: "AI Research",
      desc: "Deep research on any topic with cited sources, visual aids, and real-time structured explanations",
      color: "#34d399",
      colorBg: "#10b981",
    },
    {
      icon: Compass,
      label: "Study Roadmaps",
      desc: "Structured multi-chapter learning journeys with topics, milestones, and progress tracking",
      color: "#a78bfa",
      colorBg: "#8b5cf6",
    },
    {
      icon: Code2,
      label: "Math Notebooks",
      desc: "Interactive mathematical notebooks with live LaTeX rendering, formulas, and deep computation",
      color: "#fbbf24",
      colorBg: "#f59e0b",
    },
    {
      icon: MessageSquare,
      label: "Remi Companion",
      desc: "Socratic AI mentor with voice narration, memory retention, and tailored study momentum",
      color: "#fb7185",
      colorBg: "#f43f5e",
    },
    {
      icon: BookOpen,
      label: "Doc Intelligence",
      desc: "Upload PDFs, research papers, and video transcripts with instant synthesis and question solving",
      color: "#38bdf8",
      colorBg: "#0ea5e9",
    },
  ];

  return (
    <div className="min-h-screen bg-[#03140e] text-[#f4f4f5] overflow-x-hidden selection:bg-emerald-500/30 font-sans">
      {/* ── Navbar ── */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-500 ${
          scrollY > 40
            ? "bg-[#03140e]/85 backdrop-blur-xl border-b border-emerald-500/20 shadow-xl shadow-black/40"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 sm:h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <RemispaceBrand size="md" className="text-white" />
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-emerald-100/70">
            <a href="#features" className="hover:text-emerald-300 transition-colors">
              Features
            </a>
            <a href="#studyspace" className="hover:text-emerald-300 transition-colors">
              Study Space
            </a>
            <a href="#roadmaps" className="hover:text-emerald-300 transition-colors">
              Roadmaps
            </a>
            <a href="#notebooks" className="hover:text-emerald-300 transition-colors">
              Notebooks
            </a>
            <a href="#remi-chat" className="hover:text-emerald-300 transition-colors">
              Remi AI
            </a>
            <a href="#pricing" className="hover:text-emerald-300 transition-colors">
              Pricing
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/auth"
              search={{ mode: "signin" }}
              className="text-xs sm:text-sm font-semibold text-emerald-200/80 hover:text-white transition-colors px-3 py-2"
            >
              Sign in
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="text-xs sm:text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-4 sm:px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-200 active:scale-[0.98]"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative pt-32 sm:pt-40 pb-16 overflow-hidden">
        {/* Ambient orbs */}
        <div className="orb orb-primary w-[750px] h-[750px] -top-60 -right-60 animate-float" />
        <div
          className="orb orb-secondary w-[550px] h-[550px] bottom-0 -left-40 animate-float"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="orb w-[350px] h-[350px] top-1/3 left-1/2 animate-float"
          style={{
            background: "radial-gradient(circle, rgba(167, 139, 250, 0.15) 0%, transparent 70%)",
            animationDelay: "3.5s",
          }}
        />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          {/* Main heading */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-8 leading-[1.08] font-display">
            Master anything <br className="hidden sm:block" />
            <span className="text-gradient">10x deeper</span> with{" "}
            <span className="relative inline-block text-white">
              Remispace
              <svg
                className="absolute -bottom-2.5 left-0 w-full h-3.5"
                viewBox="0 0 200 12"
                fill="none"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 8 C40 2, 80 10, 120 6 C150 3, 175 8, 198 5"
                  stroke="#34d399"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  className="landing-underline-draw"
                />
              </svg>
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-xl text-emerald-100/75 max-w-2xl mx-auto mb-10 leading-relaxed font-sans">
            Research complex topics, generate structured mastery roadmaps, write mathematical notebooks,
            and study with Remi—your dedicated Socratic AI companion.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="group flex items-center gap-2.5 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-2xl shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 hover:scale-[1.02] text-base"
            >
              Start learning free
              <ArrowRight className="size-4.5 group-hover:translate-x-1.5 transition-transform" />
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signin" }}
              className="flex items-center gap-2 px-8 py-4 border border-emerald-500/30 rounded-2xl bg-[#072418]/60 hover:bg-[#0b3323] transition-all duration-300 text-sm font-semibold text-emerald-200 hover:text-white"
            >
              Sign in to your workspace
            </Link>
          </div>

          {/* Feature pills row */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-16">
            {features.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-md transition-all duration-300 hover:scale-105 cursor-default"
                style={{
                  borderColor: `${f.color}30`,
                  background: `${f.colorBg}12`,
                }}
              >
                <f.icon className="size-3.5" style={{ color: f.color }} />
                <span className="text-xs font-semibold" style={{ color: f.color }}>
                  {f.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Hero Screenshot Window */}
        <div className="relative z-10 max-w-6xl mx-auto px-6">
          <div className="relative rounded-2xl sm:rounded-3xl border border-emerald-500/25 overflow-hidden bg-[#061e14]/90 backdrop-blur-xl shadow-2xl shadow-black/60 landing-hero-glow">
            <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-500/20 bg-[#04170e]/80">
              <div className="flex gap-2">
                <div className="size-3 rounded-full bg-red-500/70" />
                <div className="size-3 rounded-full bg-yellow-500/70" />
                <div className="size-3 rounded-full bg-emerald-500/70" />
              </div>
              <div className="px-4 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/20 text-xs text-emerald-300/80 flex items-center gap-2">
                <Shield className="size-3 text-emerald-400" />
                remispace.app/dashboard
              </div>
              <div className="w-12" />
            </div>
            <img
              src={remispaceDashboardImg || heroStudyImg}
              alt="Remispace Deep Learning Dashboard"
              className="w-full h-auto block object-cover"
              loading="eager"
            />
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="flex justify-center mt-16">
          <a
            href="#features"
            className="flex flex-col items-center gap-2 text-emerald-400/50 hover:text-emerald-300 transition-colors"
          >
            <span className="text-[10px] font-bold tracking-[0.25em] uppercase">Discover more</span>
            <ChevronDown className="size-4 animate-bounce" />
          </a>
        </div>
      </section>

      {/* ── Features Overview ── */}
      <section
        id="features"
        ref={addRef("features")}
        className={`py-28 relative transition-all duration-1000 ${
          isVisible("features") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/[0.03] to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-5 font-display">
              Five powerful ways to <span className="text-gradient">master knowledge</span>
            </h2>
            <p className="text-emerald-100/70 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              From structured roadmaps and deep multi-source research to mathematical notebooks and 24/7 AI
              coaching—everything is crafted for deep focus.
            </p>
          </div>

          {/* 5 Feature Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 max-w-7xl mx-auto">
            {features.map((f, i) => (
              <div
                key={i}
                className="group relative p-6 rounded-2xl border border-emerald-500/20 bg-[#072418]/60 backdrop-blur-md hover:border-emerald-400/40 transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-emerald-950/60 cursor-default flex flex-col justify-between"
              >
                {/* Glow on hover */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: `radial-gradient(ellipse at center, ${f.colorBg}15 0%, transparent 70%)`,
                  }}
                />
                <div className="relative z-10">
                  <div
                    className="size-12 rounded-xl flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg"
                    style={{
                      background: `${f.colorBg}18`,
                      border: `1px solid ${f.color}30`,
                    }}
                  >
                    <f.icon className="size-5.5" style={{ color: f.color }} />
                  </div>
                  <h3 className="text-lg font-bold mb-2 tracking-tight text-white">{f.label}</h3>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Study Space & AI Research ── */}
      <section
        id="studyspace"
        ref={addRef("studyspace")}
        className={`py-28 relative transition-all duration-1000 ${
          isVisible("studyspace") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/[0.03] to-transparent pointer-events-none" />
        <div
          className="orb orb-secondary w-[400px] h-[400px] top-40 -right-20 animate-float"
          style={{ animationDelay: "1s" }}
        />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-5 font-display">
              Ask anything, get <span className="text-gradient">complete structured clarity</span>
            </h2>
            <p className="text-emerald-100/70 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Every topic produces a complete synthesized lesson: executive summaries, step-by-step
              derivations, real-world analogies, and verified source citations.
            </p>
          </div>

          {/* Scrollable Study Space Preview */}
          <div className="max-w-4xl mx-auto">
            <div className="relative rounded-2xl sm:rounded-3xl border border-emerald-500/25 overflow-hidden bg-[#061e14]/90 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-500/20 bg-[#04170e]/80">
                <div className="flex gap-2">
                  <div className="size-3 rounded-full bg-red-500/70" />
                  <div className="size-3 rounded-full bg-yellow-500/70" />
                  <div className="size-3 rounded-full bg-emerald-500/70" />
                </div>
                <div className="px-4 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/20 text-xs text-emerald-300/80 flex items-center gap-2">
                  <Shield className="size-3 text-emerald-400" />
                  remispace.app/study
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400/60">
                  <MousePointerClick className="size-3.5" />
                  <span className="text-[10px] font-semibold">Scroll to explore</span>
                </div>
              </div>
              <div
                style={{ maxHeight: "600px", overflowY: "scroll" }}
                className="screenshot-scroll-container bg-[#081711]"
              >
                <img
                  src={topicLessonScrollImg}
                  alt="Remispace Study Space and AI Lesson Synthesizer"
                  className="w-full h-auto block"
                  loading="lazy"
                />
              </div>
            </div>
            <p className="text-center text-xs text-emerald-300/60 mt-4 flex items-center justify-center gap-1.5">
              <MousePointerClick className="size-3" />
              Scroll inside preview to explore full deep research synthesis
            </p>
          </div>

          {/* Feature highlights below screenshot */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-4xl mx-auto">
            {[
              { icon: Zap, label: "TL;DR Syntheses", desc: "Fast core concept overviews" },
              { icon: BookOpen, label: "Deep Section Explanations", desc: "Structured hierarchical learning" },
              { icon: Lightbulb, label: "Real-World Analogies", desc: "Make abstract ideas stick" },
              { icon: Globe, label: "Citations & Sources", desc: "Verified literature references" },
            ].map((item, i) => (
              <div key={i} className="text-center group">
                <div className="size-12 rounded-xl bg-[#062418] border border-emerald-500/20 flex items-center justify-center mx-auto mb-3 group-hover:border-emerald-400/50 group-hover:bg-emerald-950/40 transition-all duration-300 group-hover:scale-110">
                  <item.icon className="size-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                </div>
                <p className="text-sm font-semibold mb-1 text-white">{item.label}</p>
                <p className="text-xs text-zinc-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Document Intelligence & Visual Explanations ── */}
      <section
        id="visuals"
        ref={addRef("visuals")}
        className={`py-28 transition-all duration-1000 ${
          isVisible("visuals") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Visual Explanations */}
            <div>
              <h3 className="text-2xl sm:text-4xl font-bold tracking-tight mb-4 font-display text-white">
                Learn with <span className="text-gradient">diagrams & visuals</span>
              </h3>
              <p className="text-zinc-300 mb-8 leading-relaxed text-sm sm:text-base">
                Remispace automatically synthesizes visual flowcharts, architectural diagrams, and document
                insights to make complex relationships crystal clear.
              </p>
              <div className="rounded-2xl border border-emerald-500/25 overflow-hidden shadow-2xl group/img hover:border-emerald-400/50 transition-all duration-500 bg-[#061e14]">
                <img
                  src={incontextImg}
                  alt="In-context learning and document diagrams"
                  className="w-full h-auto block transition-transform duration-700 group-hover/img:scale-[1.02]"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Video Notes & Transcripts */}
            <div>
              <h3 className="text-2xl sm:text-4xl font-bold tracking-tight mb-4 font-display text-white">
                Turn any video into <span className="text-gradient">actionable notes</span>
              </h3>
              <p className="text-zinc-300 mb-8 leading-relaxed text-sm sm:text-base">
                Paste YouTube lecture links or lecture recordings to extract timestamped summaries, interactive
                transcripts, and auto-generated review quizzes.
              </p>
              <div className="rounded-2xl border border-emerald-500/25 overflow-hidden shadow-2xl group/img hover:border-emerald-400/50 transition-all duration-500 bg-[#061e14]">
                <img
                  src={tasksImg}
                  alt="Video lecture notes, milestones and task tracking"
                  className="w-full h-auto block transition-transform duration-700 group-hover/img:scale-[1.02]"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Learning Modes: Roadmaps & Notebooks ── */}
      <section
        id="roadmaps"
        ref={addRef("roadmaps")}
        className={`py-28 relative transition-all duration-1000 ${
          isVisible("roadmaps") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/[0.03] to-transparent pointer-events-none" />
        <div className="orb orb-primary w-[500px] h-[500px] top-1/3 -left-40 animate-float" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-5 font-display">
              Structured <span className="text-gradient">learning journeys</span>
            </h2>
            <p className="text-emerald-100/70 text-base sm:text-lg max-w-xl mx-auto">
              From roadmaps with progressive milestones to live mathematical computing notebooks.
            </p>
          </div>

          {/* Mode 1: Roadmaps */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-28">
            <div className="order-2 lg:order-1">
              <div className="relative rounded-2xl sm:rounded-3xl border border-purple-500/30 overflow-hidden bg-[#061914] shadow-2xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/20 bg-[#051410]">
                  <div className="flex gap-2">
                    <div className="size-3 rounded-full bg-red-500/70" />
                    <div className="size-3 rounded-full bg-yellow-500/70" />
                    <div className="size-3 rounded-full bg-green-500/70" />
                  </div>
                  <div className="px-3 py-1 rounded-lg bg-purple-500/10 text-xs text-purple-300 font-semibold flex items-center gap-1.5">
                    <GraduationCap className="size-3.5" />
                    Mastery Roadmap
                  </div>
                  <div className="flex items-center gap-1.5 text-purple-300/60">
                    <MousePointerClick className="size-3.5" />
                    <span className="text-[10px]">Scroll</span>
                  </div>
                </div>
                <div style={{ maxHeight: "500px", overflowY: "scroll" }} className="screenshot-scroll-container">
                  <img
                    src={roadmapsImg}
                    alt="Remispace Structured Learning Roadmap"
                    className="w-full h-auto block"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <h3 className="text-2xl sm:text-4xl font-bold tracking-tight mb-5 font-display text-white">
                Step-by-step paths for <span className="text-gradient">subject mastery</span>
              </h3>
              <p className="text-zinc-300 leading-relaxed mb-8 text-sm sm:text-base">
                Enter any subject—Quantum Physics, Distributed Systems, Linear Algebra—and Remispace creates an
                exhaustive curriculum with milestones, chapters, and active recall checkpoints.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Layers, text: "Curriculum generation with structured sub-topics" },
                  { icon: FileText, text: "In-depth synthesized lesson notes per milestone" },
                  { icon: CheckCircle2, text: "Adaptive quizzes and spaced repetition flashcards" },
                  { icon: BarChart3, text: "Real-time mastery and momentum tracking" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="size-8 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0 mt-0.5 border border-purple-500/30">
                      <item.icon className="size-4 text-purple-300" />
                    </div>
                    <span className="text-zinc-300 text-sm leading-relaxed">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mode 2: Mathematical Notebooks */}
          <div id="notebooks" className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl sm:text-4xl font-bold tracking-tight mb-5 font-display text-white">
                Live computation & <span className="text-gradient">LaTeX equations</span>
              </h3>
              <p className="text-zinc-300 leading-relaxed mb-8 text-sm sm:text-base">
                Write formulas, compute step-by-step calculus, solve equations, and document your theorems with
                first-class KaTeX rendering and mathematical AI assistants.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Brain, text: "Real-time LaTeX formula compilation and rendering" },
                  { icon: Star, text: "Calculus, matrix, and statistics step-by-step solvers" },
                  { icon: Target, text: "Interactive sandbox blocks for derivations" },
                  { icon: Lightbulb, text: "Export notes to Markdown, PDF, and shareable web snapshots" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="size-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5 border border-amber-500/30">
                      <item.icon className="size-4 text-amber-300" />
                    </div>
                    <span className="text-zinc-300 text-sm leading-relaxed">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="relative rounded-2xl sm:rounded-3xl border border-amber-500/30 overflow-hidden bg-[#061914] shadow-2xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/20 bg-[#051410]">
                  <div className="flex gap-2">
                    <div className="size-3 rounded-full bg-red-500/70" />
                    <div className="size-3 rounded-full bg-yellow-500/70" />
                    <div className="size-3 rounded-full bg-green-500/70" />
                  </div>
                  <div className="px-3 py-1 rounded-lg bg-amber-500/10 text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                    <Code2 className="size-3.5" />
                    Math Notebook
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-300/60">
                    <MousePointerClick className="size-3.5" />
                    <span className="text-[10px]">Scroll</span>
                  </div>
                </div>
                <div style={{ maxHeight: "500px", overflowY: "scroll" }} className="screenshot-scroll-container">
                  <img
                    src={notebookImg}
                    alt="Remispace Mathematical Notebook with LaTeX and live equations"
                    className="w-full h-auto block"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Remi AI Companion Spotlight ── */}
      <section
        id="remi-chat"
        ref={addRef("remi-chat")}
        className={`py-28 relative transition-all duration-1000 ${
          isVisible("remi-chat") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-rose-500/[0.03] to-transparent pointer-events-none" />
        <div
          className="orb w-[500px] h-[500px] top-20 -right-40 animate-float"
          style={{ background: "radial-gradient(circle, rgba(244, 63, 94, 0.12) 0%, transparent 70%)" }}
        />

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-5 font-display">
              Meet Remi, your <span className="text-gradient">calm AI study companion</span>
            </h2>
            <p className="text-emerald-100/70 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Unlike generic chatbots, Remi retains context of your current roadmap, quizzes you using Socratic
              dialogue, and explains concepts using analogies and clear mathematics.
            </p>
          </div>

          {/* Full-width Chat Screenshot */}
          <div className="relative mb-16">
            <div className="relative rounded-2xl sm:rounded-3xl border border-rose-500/30 overflow-hidden bg-[#061914] shadow-2xl hover:border-rose-400/50 transition-all duration-500">
              <div className="flex items-center justify-between px-4 py-3 border-b border-rose-500/20 bg-[#051410]">
                <div className="flex gap-2">
                  <div className="size-3 rounded-full bg-red-500/70" />
                  <div className="size-3 rounded-full bg-yellow-500/70" />
                  <div className="size-3 rounded-full bg-green-500/70" />
                </div>
                <div className="px-3 py-1 rounded-lg bg-rose-500/10 text-xs text-rose-300 font-semibold flex items-center gap-1.5">
                  <MessageSquare className="size-3.5" />
                  Remi Socratic Chat
                </div>
                <div className="flex items-center gap-1.5 text-rose-300/60">
                  <Volume2 className="size-3.5" />
                  <span className="text-[10px]">Speech & Audio</span>
                </div>
              </div>
              <img
                src={remichatImg}
                alt="Remi AI study assistant chat interface with mathematical derivations"
                className="w-full h-auto block"
                loading="lazy"
              />
            </div>
          </div>

          {/* Feature bullets — grid below the image */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 max-w-5xl mx-auto mb-12">
            {[
              { icon: MessageSquare, text: "Socratic questioning that reinforces real understanding" },
              { icon: Code2, text: "Complete LaTeX mathematical rendering and formulas" },
              { icon: Mic, text: "Natural text-to-speech voice narration" },
              { icon: Layers, text: "Persistent context across roadmaps and study spaces" },
              { icon: Sparkles, text: "One-click generation of flashcards & checkpoint quizzes" },
            ].map((item, i) => (
              <div
                key={i}
                className="flex flex-col items-center text-center gap-3 p-5 rounded-2xl border border-emerald-500/15 bg-[#072418]/40 backdrop-blur-md hover:border-rose-500/30 hover:bg-rose-500/[0.04] transition-all duration-300"
              >
                <div className="size-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
                  <item.icon className="size-4.5 text-rose-300" />
                </div>
                <span className="text-zinc-300 text-xs leading-relaxed">{item.text}</span>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="group inline-flex items-center gap-2.5 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-2xl shadow-xl shadow-emerald-500/25 transition-all duration-300 hover:scale-[1.02] text-base"
            >
              Start Chatting with Remi
              <ArrowRight className="size-4.5 group-hover:translate-x-1.5 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Pricing & Payments Section ── */}
      <section
        id="pricing"
        ref={addRef("pricing")}
        className={`py-28 relative transition-all duration-1000 ${
          isVisible("pricing") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/[0.03] to-transparent pointer-events-none" />
        <div
          className="orb orb-primary w-[500px] h-[500px] top-1/4 -right-40 animate-float"
          style={{ animationDelay: "1.5s" }}
        />

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-5 font-display text-white">
              Invest in your <span className="text-gradient">deep mastery</span>
            </h2>
            <p className="text-emerald-100/70 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
              Start completely free, then upgrade to Pro when you need unlimited AI reasoning, expanded
              roadmaps, and larger file processing.
            </p>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {/* Free Tier */}
            <div className="rounded-3xl border border-emerald-500/20 bg-[#061e14]/70 p-7 sm:p-8 flex flex-col justify-between backdrop-blur-xl shadow-xl transition-all duration-300 hover:border-emerald-500/40">
              <div>
                <h3 className="text-xl font-bold text-white mb-1 font-display">Free Explorer</h3>
                <p className="text-xs text-zinc-400 mb-6">For casual study and learning exploration.</p>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-extrabold text-white">₹0</span>
                  <span className="text-sm font-medium text-zinc-400">/ forever</span>
                </div>
                <ul className="space-y-3.5 text-sm text-zinc-300 mb-8">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>20 daily messages with Remi AI</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>2 Structured Roadmaps per week</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>5 Mathematical Notebooks</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>15MB Document upload limit</span>
                  </li>
                  <li className="flex items-center gap-2.5 text-zinc-500">
                    <CheckCircle2 className="size-4 text-zinc-600 shrink-0" />
                    <span>Standard response speed</span>
                  </li>
                </ul>
              </div>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="w-full py-3 px-4 rounded-xl border border-emerald-500/30 bg-[#092b1d] hover:bg-[#0e3b28] text-emerald-300 hover:text-white text-sm font-bold text-center transition-all duration-150 active:scale-[0.99]"
              >
                Get Started Free
              </Link>
            </div>

            {/* Weekly Pro Tier (Highlighted) */}
            <div className="relative rounded-3xl border-2 border-emerald-400/60 bg-[#082a1c]/90 p-7 sm:p-8 flex flex-col justify-between backdrop-blur-2xl shadow-2xl shadow-emerald-950/80 transition-all duration-300 hover:border-emerald-400">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-950 shadow-md">
                Most Popular
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1 font-display">Weekly Pro</h3>
                <p className="text-xs text-emerald-200/70 mb-6">Ideal for focused study sprints & exam prep.</p>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-extrabold text-white">₹99</span>
                  <span className="text-sm font-medium text-emerald-200/70">/ week</span>
                </div>
                <ul className="space-y-3.5 text-sm text-zinc-200 mb-8">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span className="font-semibold text-white">Unlimited messages with Remi AI</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>10 Structured Roadmaps per week</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>15 Mathematical Notebooks per week</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>50MB Document & paper uploads</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>Instant Flashcards & SRS Reviews</span>
                  </li>
                </ul>
              </div>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-bold text-center shadow-lg shadow-emerald-500/25 transition-all duration-150 active:scale-[0.99]"
              >
                Upgrade to Weekly Pro
              </Link>
            </div>

            {/* Monthly Pro Tier */}
            <div className="rounded-3xl border border-emerald-500/20 bg-[#061e14]/70 p-7 sm:p-8 flex flex-col justify-between backdrop-blur-xl shadow-xl transition-all duration-300 hover:border-emerald-500/40">
              <div>
                <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wider mb-2">
                  Best Value — Save 10%
                </div>
                <h3 className="text-xl font-bold text-white mb-1 font-display">Monthly Pro</h3>
                <p className="text-xs text-zinc-400 mb-6">For continuous semester mastery & deep thinkers.</p>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-extrabold text-white">₹399</span>
                  <span className="text-sm font-medium text-zinc-400">/ month</span>
                </div>
                <ul className="space-y-3.5 text-sm text-zinc-300 mb-8">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>All Weekly Pro capabilities</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>~10% Savings over weekly renewal</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>Priority multi-model AI synthesis</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>Export to PDF, LaTeX, & Markdown</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>Priority dedicated support</span>
                  </li>
                </ul>
              </div>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="w-full py-3 px-4 rounded-xl border border-emerald-500/30 bg-[#092b1d] hover:bg-[#0e3b28] text-emerald-300 hover:text-white text-sm font-bold text-center transition-all duration-150 active:scale-[0.99]"
              >
                Upgrade to Monthly Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA Section ── */}
      <section id="cta" ref={addRef("cta")} className="py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/[0.06] via-transparent to-transparent pointer-events-none" />
        <div
          className="orb orb-primary w-[600px] h-[600px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ opacity: 0.1 }}
        />

        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 font-display text-white">
            Build lasting mastery with <span className="text-gradient">Remispace</span>
          </h2>
          <p className="text-emerald-100/75 text-base sm:text-xl mb-10 max-w-xl mx-auto leading-relaxed">
            Create structured roadmaps, synthesize research papers, write mathematical notes, and study with
            Remi today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="group flex items-center gap-2 px-8 sm:px-10 py-4 sm:py-5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-2xl shadow-2xl shadow-emerald-500/30 transition-all duration-300 hover:scale-[1.03] text-base sm:text-lg"
            >
              Get started free
              <ArrowRight className="size-5 group-hover:translate-x-1.5 transition-transform" />
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signin" }}
              className="flex items-center gap-2 px-8 py-4 sm:py-5 border border-emerald-500/30 rounded-2xl bg-[#072418]/60 hover:bg-[#0b3323] transition-all duration-300 text-sm font-semibold text-emerald-200 hover:text-white"
            >
              Sign in to your account
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-emerald-500/20 py-12 bg-[#02100b]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Link to="/" className="hover:opacity-90 transition-opacity">
                <RemispaceBrand size="md" className="text-white" />
              </Link>
              <span className="text-xs text-zinc-400 ml-2 hidden sm:inline">
                A quiet sanctuary for deep learning & structured roadmaps
              </span>
            </div>
            <div className="flex items-center gap-6 text-xs text-zinc-400">
              <a href="#features" className="hover:text-white transition-colors">
                Features
              </a>
              <a href="#studyspace" className="hover:text-white transition-colors">
                Study Space
              </a>
              <a href="#roadmaps" className="hover:text-white transition-colors">
                Roadmaps
              </a>
              <a href="#pricing" className="hover:text-white transition-colors">
                Pricing
              </a>
              <Link to="/auth" search={{ mode: "signin" }} className="hover:text-white transition-colors">
                Sign in
              </Link>
            </div>
            <p className="text-xs text-zinc-500">
              &copy; {new Date().getFullYear()} Remispace. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
