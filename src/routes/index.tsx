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
  VolumeX,
  Compass,
  Code2,
  HelpCircle,
  Timer,
  Flame,
  ListTodo,
  TrendingUp,
  Calendar,
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
import notebookScrollImg from "@/assets/notebook-scroll.png";
import videoIntelScrollImg from "@/assets/video-intel-scroll.png";
import docIntelScrollImg from "@/assets/doc-intel-scroll.png";
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
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVideoMouseEnter = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      void videoRef.current.play().catch(() => {});
    }
  };

  const handleVideoMouseLeave = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

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
      label: "Clean Notebooks",
      desc: "Structured notebooks with clean formatting, live LaTeX equations, code blocks, and derivations",
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
            <a href="#roadmaps" className="hover:text-emerald-300 transition-colors">
              Roadmaps
            </a>
            <a href="#notebooks" className="hover:text-emerald-300 transition-colors">
              Notebooks
            </a>
            <a href="#doc-intelligence" className="hover:text-emerald-300 transition-colors">
              Doc Intelligence
            </a>
            <a href="#tasks-goals" className="hover:text-emerald-300 transition-colors">
              Tasks & Goals
            </a>
            <a href="#pricing" className="hover:text-emerald-300 transition-colors">
              Pricing
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/auth"
              search={{ mode: "signin" }}
              className="text-xs sm:text-sm font-medium text-zinc-300 hover:text-white transition-all px-3.5 py-2 hover:bg-white/[0.08] rounded-xl"
            >
              Sign in
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="text-xs sm:text-sm font-bold bg-emerald-400 hover:bg-emerald-300 text-zinc-950 px-4 sm:px-5 py-2.5 rounded-xl shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0.5"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative pt-32 sm:pt-40 pb-16 overflow-hidden">
        {/* Background Grid Pattern & Ambient orbs */}
        <div className="absolute inset-0 hero-grid-pattern opacity-60 pointer-events-none [mask-image:radial-gradient(ellipse_60%_50%_at_50%_35%,#000_70%,transparent_100%)]" />
        <div className="orb orb-primary w-[800px] h-[800px] -top-60 -right-60 animate-float" />
        <div
          className="orb orb-secondary w-[600px] h-[600px] bottom-0 -left-40 animate-float"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="orb w-[500px] h-[500px] top-10 left-1/2 -translate-x-1/2 animate-float pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, rgba(20, 184, 166, 0.08) 50%, transparent 75%)",
            animationDelay: "1s",
          }}
        />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          {/* Main heading */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[5.25rem] font-bold tracking-tight mb-7 leading-[1.06] font-display text-white">
            Master complex subjects <br className="hidden sm:block" />
            <span className="text-gradient">10x deeper</span> with Remispace
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-xl text-emerald-100/80 max-w-2xl mx-auto mb-10 leading-relaxed font-sans font-normal">
            Transform intimidating topics, research papers, and lectures into structured mastery roadmaps,
            clean mathematical notebooks, and interactive active-recall sessions with Remi.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="group flex items-center gap-2.5 px-8 sm:px-9 py-4 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-bold rounded-2xl shadow-xl transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0.5 text-base"
            >
              Start learning free
              <ArrowRight className="size-4.5 group-hover:translate-x-1 transition-transform duration-200" />
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signin" }}
              className="flex items-center gap-2 px-8 sm:px-9 py-4 border border-emerald-500/40 hover:border-emerald-400/80 rounded-2xl bg-[#092218] hover:bg-[#0f3325] transition-all duration-200 text-base font-semibold text-emerald-100 hover:text-white shadow-md hover:-translate-y-0.5 active:translate-y-0.5"
            >
              Sign in to your workspace
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="flex justify-center mt-10 mb-8">
          <a
            href="#demo-video"
            className="flex flex-col items-center gap-2 text-emerald-400/50 hover:text-emerald-300 transition-colors"
          >
            <span className="text-[10px] font-bold tracking-[0.25em] uppercase">Discover more</span>
            <ChevronDown className="size-4 animate-bounce" />
          </a>
        </div>

        {/* ── Demo Video (Plays on Hover, Resets on Unhover) ── */}
        <div id="demo-video" className="relative z-10 max-w-5xl mx-auto px-6 mb-8">
          <div
            className="relative rounded-2xl sm:rounded-3xl border border-amber-500/30 hover:border-amber-400/50 transition-all duration-500 overflow-hidden bg-[#061914] shadow-2xl hover:shadow-amber-950/50 cursor-pointer group"
            onMouseEnter={handleVideoMouseEnter}
            onMouseLeave={handleVideoMouseLeave}
          >
            {/* Window Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/20 bg-[#051410]">
              <div className="flex gap-2">
                <div className="size-3 rounded-full bg-red-500/70" />
                <div className="size-3 rounded-full bg-yellow-500/70" />
                <div className="size-3 rounded-full bg-green-500/70" />
              </div>
              <div className="px-3 py-1 rounded-lg bg-amber-500/10 text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                <Sparkles className="size-3.5" />
                Interactive Workspace
              </div>
              <div className="w-12" />
            </div>

            {/* Video Container */}
            <div className="relative aspect-video w-full bg-[#020b08] overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                src="/demo-preview.mp4"
                muted
                loop
                playsInline
                preload="auto"
                className="w-full h-full object-cover block"
              />
            </div>
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
            <div className="relative rounded-2xl sm:rounded-3xl border border-amber-500/30 hover:border-amber-400/50 transition-all duration-500 overflow-hidden bg-[#061914] shadow-2xl hover:shadow-amber-950/50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/20 bg-[#051410]">
                <div className="flex gap-2">
                  <div className="size-3 rounded-full bg-red-500/70" />
                  <div className="size-3 rounded-full bg-yellow-500/70" />
                  <div className="size-3 rounded-full bg-green-500/70" />
                </div>
                <div className="px-3 py-1 rounded-lg bg-amber-500/10 text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                  <Brain className="size-3.5" />
                  AI Lesson Synthesizer
                </div>
                <div className="flex items-center gap-1.5 text-amber-300/60">
                  <MousePointerClick className="size-3.5" />
                  <span className="text-[10px]">Scroll</span>
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
            <p className="text-center text-xs text-amber-300/60 mt-4 flex items-center justify-center gap-1.5">
              <MousePointerClick className="size-3" />
              Scroll inside the preview to explore a full Remi-synthesized lesson
            </p>
          </div>
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
              <div className="relative rounded-2xl sm:rounded-3xl border border-amber-500/30 hover:border-amber-400/50 transition-all duration-500 overflow-hidden bg-[#061914] shadow-2xl hover:shadow-amber-950/50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/20 bg-[#051410]">
                  <div className="flex gap-2">
                    <div className="size-3 rounded-full bg-red-500/70" />
                    <div className="size-3 rounded-full bg-yellow-500/70" />
                    <div className="size-3 rounded-full bg-green-500/70" />
                  </div>
                  <div className="px-3 py-1 rounded-lg bg-amber-500/10 text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                    <GraduationCap className="size-3.5" />
                    Mastery Roadmap
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-300/60">
                    <MousePointerClick className="size-3.5" />
                    <span className="text-[10px]">Scroll</span>
                  </div>
                </div>
                <div style={{ maxHeight: "500px", overflowY: "scroll" }} className="screenshot-scroll-container">
                  <img
                    src={roadmapScrollImg}
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

          {/* Mode 2: Clean Notebook Generation */}
          <div id="notebooks" className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl sm:text-4xl font-bold tracking-tight mb-5 font-display text-white">
                Clean <span className="text-gradient">Notebook generation</span>
              </h3>
              <p className="text-zinc-300 leading-relaxed mb-8 text-sm sm:text-base">
                Generate beautifully structured study notebooks with clear mathematical formulas, conceptual
                explanations, step-by-step code blocks, and distraction-free formatting tailored for deep comprehension.
              </p>
              <div className="space-y-4">
                {[
                  { icon: FileText, text: "Automated generation of structured, distraction-free study notebooks" },
                  { icon: Brain, text: "Crystal-clear LaTeX mathematical notation and formula rendering" },
                  { icon: Code2, text: "Interactive code snippets, algorithmic logic, and derivations" },
                  { icon: Lightbulb, text: "Export notes cleanly to Markdown, PDF, and shareable web snapshots" },
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
              <div className="relative rounded-2xl sm:rounded-3xl border border-amber-500/30 hover:border-amber-400/50 transition-all duration-500 overflow-hidden bg-[#061914] shadow-2xl hover:shadow-amber-950/50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/20 bg-[#051410]">
                  <div className="flex gap-2">
                    <div className="size-3 rounded-full bg-red-500/70" />
                    <div className="size-3 rounded-full bg-yellow-500/70" />
                    <div className="size-3 rounded-full bg-green-500/70" />
                  </div>
                  <div className="px-3 py-1 rounded-lg bg-amber-500/10 text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                    <Code2 className="size-3.5" />
                    Clean Notebook
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-300/60">
                    <MousePointerClick className="size-3.5" />
                    <span className="text-[10px]">Scroll</span>
                  </div>
                </div>
                <div style={{ maxHeight: "500px", overflowY: "scroll" }} className="screenshot-scroll-container">
                  <img
                    src={notebookScrollImg}
                    alt="Remispace Clean Study Notebook with LaTeX and live equations"
                    className="w-full h-auto block"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Document & Video Intelligence ── */}
      <section
        id="doc-intelligence"
        ref={addRef("doc-intelligence")}
        className={`py-28 relative transition-all duration-1000 ${
          isVisible("doc-intelligence") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-sky-500/[0.03] to-transparent pointer-events-none" />
        <div
          className="orb w-[500px] h-[500px] top-1/4 -right-40 animate-float"
          style={{ background: "radial-gradient(circle, rgba(56, 189, 248, 0.12) 0%, transparent 70%)" }}
        />
        <div
          className="orb w-[450px] h-[450px] bottom-10 -left-32 animate-float"
          style={{ background: "radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, transparent 70%)", animationDelay: "2s" }}
        />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-5 font-display">
              Turn documents & videos into <span className="text-gradient">deep knowledge</span>
            </h2>
            <p className="text-emerald-100/70 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Upload research papers, technical PDFs, or paste YouTube lecture links. Get instant executive summaries,
              timestamped transcripts, in-line highlights, and interactive Socratic dialogue with Remi.
            </p>
          </div>

          {/* Mode 1: Technical Papers & PDFs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-28">
            <div>
              <h3 className="text-2xl sm:text-4xl font-bold tracking-tight mb-5 font-display text-white">
                Synthesize <span className="text-gradient">research papers & PDFs</span>
              </h3>
              <p className="text-zinc-300 leading-relaxed mb-8 text-sm sm:text-base">
                Upload complex whitepapers, textbooks, and technical documents. Remispace extracts an executive
                &ldquo;Before You Commit&rdquo; synthesis, enables multi-page reading with highlights, and lets you ask
                context-aware questions with instant citations.
              </p>
              <div className="space-y-4">
                {[
                  { icon: FileText, text: 'Instant "Before You Commit" executive briefs & key takeaways' },
                  { icon: Search, text: "In-line highlighting, formula capture, and literature citations" },
                  { icon: MessageSquare, text: "Ask Remi deep questions directly grounded in the paper's contents" },
                  { icon: Sparkles, text: "Auto-generate flashcards and review quizzes from your highlights" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="size-8 rounded-lg bg-sky-500/15 flex items-center justify-center shrink-0 mt-0.5 border border-sky-500/30">
                      <item.icon className="size-4 text-sky-300" />
                    </div>
                    <span className="text-zinc-300 text-sm leading-relaxed">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="relative rounded-2xl sm:rounded-3xl border border-amber-500/30 hover:border-amber-400/50 transition-all duration-500 overflow-hidden bg-[#061914] shadow-2xl hover:shadow-amber-950/50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/20 bg-[#051410]">
                  <div className="flex gap-2">
                    <div className="size-3 rounded-full bg-red-500/70" />
                    <div className="size-3 rounded-full bg-yellow-500/70" />
                    <div className="size-3 rounded-full bg-green-500/70" />
                  </div>
                  <div className="px-3 py-1 rounded-lg bg-amber-500/10 text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                    <FileText className="size-3.5" />
                    Document Intelligence
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-300/60">
                    <MousePointerClick className="size-3.5" />
                    <span className="text-[10px]">Scroll</span>
                  </div>
                </div>
                <div style={{ maxHeight: "540px", overflowY: "scroll" }} className="screenshot-scroll-container">
                  <img
                    src={docIntelScrollImg}
                    alt="Remispace Document Intelligence with paper synthesis and highlights"
                    className="w-full h-auto block"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Mode 2: YouTube Video Intelligence */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="relative rounded-2xl sm:rounded-3xl border border-amber-500/30 hover:border-amber-400/50 transition-all duration-500 overflow-hidden bg-[#061914] shadow-2xl hover:shadow-amber-950/50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/20 bg-[#051410]">
                  <div className="flex gap-2">
                    <div className="size-3 rounded-full bg-red-500/70" />
                    <div className="size-3 rounded-full bg-yellow-500/70" />
                    <div className="size-3 rounded-full bg-green-500/70" />
                  </div>
                  <div className="px-3 py-1 rounded-lg bg-amber-500/10 text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                    <Play className="size-3.5" />
                    YouTube Video Intelligence
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-300/60">
                    <MousePointerClick className="size-3.5" />
                    <span className="text-[10px]">Scroll</span>
                  </div>
                </div>
                <div style={{ maxHeight: "540px", overflowY: "scroll" }} className="screenshot-scroll-container">
                  <img
                    src={videoIntelScrollImg}
                    alt="Remispace Video Intelligence with timestamped transcripts and notes"
                    className="w-full h-auto block"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <h3 className="text-2xl sm:text-4xl font-bold tracking-tight mb-5 font-display text-white">
                Timestamped <span className="text-gradient">video notes & transcripts</span>
              </h3>
              <p className="text-zinc-300 leading-relaxed mb-8 text-sm sm:text-base">
                Paste any YouTube lecture, conference talk, or tutorial. Remispace extracts timestamped transcripts,
                generates conceptual summaries, lets you pin notes at specific seconds, and answers your questions with Remi.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Play, text: "Automatic speech-to-text transcript sync with precise timestamps" },
                  { icon: Zap, text: "One-click 'Generate note' for any key lecture moment" },
                  { icon: MessageSquare, text: "Ask Remi to deconstruct abstract concepts using real-world analogies" },
                  { icon: BookOpen, text: "Export takeaways directly to your study roadmaps or math notebooks" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="size-8 rounded-lg bg-rose-500/15 flex items-center justify-center shrink-0 mt-0.5 border border-rose-500/30">
                      <item.icon className="size-4 text-rose-300" />
                    </div>
                    <span className="text-zinc-300 text-sm leading-relaxed">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Study Space, Tasks & Goals ── */}
      <section
        id="tasks-goals"
        ref={addRef("tasks-goals")}
        className={`py-28 relative transition-all duration-1000 ${
          isVisible("tasks-goals") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/[0.035] to-transparent pointer-events-none" />
        <div className="orb orb-primary w-[550px] h-[550px] top-10 -left-40 animate-float" />
        <div
          className="orb orb-secondary w-[450px] h-[450px] bottom-10 -right-32 animate-float"
          style={{ animationDelay: "2.5s" }}
        />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          {/* Header */}
          <div className="text-center mb-20">
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-5 font-display">
              A focused sanctuary for <span className="text-gradient">study, tasks & goals</span>
            </h2>
            <p className="text-emerald-100/70 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Zero clutter, maximum momentum. Structure your roadmap milestones into actionable daily tasks, launch
              focused study sessions with built-in timers, and achieve ambitious learning goals.
            </p>
          </div>

          {/* 3 Value Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Card 1 */}
            <div className="group relative p-8 rounded-3xl border border-emerald-500/20 bg-[#072418]/60 backdrop-blur-xl hover:border-emerald-400/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-emerald-950/80 flex flex-col justify-between overflow-hidden">
              <div
                className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: "radial-gradient(circle at top right, rgba(16, 185, 129, 0.15) 0%, transparent 70%)",
                }}
              />
              <div className="relative z-10">
                <div className="size-13 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-6 text-emerald-400 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all duration-300 shadow-lg shadow-emerald-950/50">
                  <Timer className="size-6 text-emerald-300" />
                </div>
                <div className="text-[11px] font-bold text-emerald-400/80 uppercase tracking-widest mb-2">
                  Deep Focus Cockpit
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3.5 font-display tracking-tight leading-snug">
                  Dedicated <span className="text-gradient">Study Space sessions</span>
                </h3>
                <p className="text-zinc-300 text-sm leading-relaxed mb-6">
                  Eliminate 20 open browser tabs. Access your current lesson notes, active roadmap milestones, live
                  scratchpad, and Pomodoro flow timers in one distraction-free canvas.
                </p>
              </div>
              <ul className="relative z-10 space-y-3 text-xs text-emerald-200/80 pt-5 border-t border-emerald-500/15">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                  <span>15m, 25m & 45m Pomodoro & flow timers</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                  <span>Next milestone launcher with auto-context</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                  <span>Integrated notebook and active recall drawer</span>
                </li>
              </ul>
            </div>

            {/* Card 2 */}
            <div className="group relative p-8 rounded-3xl border border-teal-500/20 bg-[#072418]/60 backdrop-blur-xl hover:border-teal-400/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-emerald-950/80 flex flex-col justify-between overflow-hidden">
              <div
                className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: "radial-gradient(circle at top right, rgba(20, 184, 166, 0.15) 0%, transparent 70%)",
                }}
              />
              <div className="relative z-10">
                <div className="size-13 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center mb-6 text-teal-400 group-hover:scale-110 group-hover:bg-teal-500/20 transition-all duration-300 shadow-lg shadow-emerald-950/50">
                  <ListTodo className="size-6 text-teal-300" />
                </div>
                <div className="text-[11px] font-bold text-teal-400/80 uppercase tracking-widest mb-2">
                  Actionable Milestones
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3.5 font-display tracking-tight leading-snug">
                  Actionable <span className="text-gradient">Task orchestration</span>
                </h3>
                <p className="text-zinc-300 text-sm leading-relaxed mb-6">
                  Turn intimidating subjects into bite-sized daily achievements. Remi auto-generates sequential tasks
                  from your roadmaps, assigns priority levels, and lets you start a session in 1 click.
                </p>
              </div>
              <ul className="relative z-10 space-y-3 text-xs text-emerald-200/80 pt-5 border-t border-emerald-500/15">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-teal-400 shrink-0" />
                  <span>Auto-task creation from roadmap milestones</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-teal-400 shrink-0" />
                  <span>Priority tags with due dates & schedule view</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-teal-400 shrink-0" />
                  <span>One-click jump directly to lesson notes</span>
                </li>
              </ul>
            </div>

            {/* Card 3 - Goals & Milestones */}
            <div className="group relative p-8 rounded-3xl border border-amber-500/20 bg-[#072418]/60 backdrop-blur-xl hover:border-amber-400/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-emerald-950/80 flex flex-col justify-between overflow-hidden">
              <div
                className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: "radial-gradient(circle at top right, rgba(245, 158, 11, 0.15) 0%, transparent 70%)",
                }}
              />
              <div className="relative z-10">
                <div className="size-13 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-6 text-amber-400 group-hover:scale-110 group-hover:bg-amber-500/20 transition-all duration-300 shadow-lg shadow-emerald-950/50">
                  <Target className="size-6 text-amber-300" />
                </div>
                <div className="text-[11px] font-bold text-amber-400/80 uppercase tracking-widest mb-2">
                  Ambitions & Milestones
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3.5 font-display tracking-tight leading-snug">
                  Goals & <span className="text-gradient">Milestone tracking</span>
                </h3>
                <p className="text-zinc-300 text-sm leading-relaxed mb-6">
                  Define big learning ambitions and break them down into trackable milestones. Set target deadlines,
                  visualize completion progress, and let Remi keep you accountable toward mastery.
                </p>
              </div>
              <ul className="relative z-10 space-y-3 text-xs text-emerald-200/80 pt-5 border-t border-emerald-500/15">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-amber-400 shrink-0" />
                  <span>Long-term academic & skill mastery goals</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-amber-400 shrink-0" />
                  <span>Hierarchical milestone breakdown & deadlines</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-amber-400 shrink-0" />
                  <span>Visual progress bars & completion celebrations</span>
                </li>
              </ul>
            </div>
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
            <div className="group relative rounded-3xl border border-emerald-500/20 bg-[#061e14]/70 p-7 sm:p-8 flex flex-col justify-between backdrop-blur-xl shadow-xl transition-all duration-500 hover:border-emerald-400/50 hover:-translate-y-2 hover:shadow-2xl hover:shadow-emerald-950/80">
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
                    <span>5 Clean Notebooks per week</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>2 Deep Research per week</span>
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
                className="w-full py-3.5 px-4 rounded-xl border border-emerald-500/30 bg-[#092218] hover:bg-[#0f3325] text-emerald-200 hover:text-white font-bold text-sm text-center shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0.5"
              >
                Get Started Free
              </Link>
            </div>

            {/* Weekly Pro Tier (Highlighted) */}
            <div className="group relative rounded-3xl border-2 border-emerald-400/60 bg-[#082a1c]/90 p-7 sm:p-8 flex flex-col justify-between backdrop-blur-2xl shadow-2xl shadow-emerald-950/80 transition-all duration-500 hover:border-emerald-300 hover:-translate-y-2 hover:shadow-emerald-900/60">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-400 px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-zinc-950 shadow-md">
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
                    <span>15 Clean Notebooks per week</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span className="font-semibold text-emerald-300">5 Deep Research per week</span>
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
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-sm font-extrabold text-center shadow-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0.5"
              >
                Upgrade to Weekly Pro
              </Link>
            </div>

            {/* Monthly Pro Tier */}
            <div className="group relative rounded-3xl border border-emerald-500/20 bg-[#061e14]/70 p-7 sm:p-8 flex flex-col justify-between backdrop-blur-xl shadow-xl transition-all duration-500 hover:border-emerald-400/50 hover:-translate-y-2 hover:shadow-2xl hover:shadow-emerald-950/80">
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
                className="w-full py-3.5 px-4 rounded-xl border border-emerald-500/40 bg-[#0c2a1e] hover:bg-[#123829] text-white font-bold text-sm text-center shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0.5"
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
              className="group flex items-center gap-2.5 px-8 sm:px-10 py-4 sm:py-5 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-bold rounded-2xl shadow-xl transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0.5 text-base sm:text-lg"
            >
              Get started free
              <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform duration-200" />
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signin" }}
              className="flex items-center gap-2 px-8 py-4 sm:py-5 border border-emerald-500/40 hover:border-emerald-400/80 rounded-2xl bg-[#092218] hover:bg-[#0f3325] transition-all duration-200 text-sm sm:text-base font-semibold text-emerald-100 hover:text-white shadow-md hover:-translate-y-0.5 active:translate-y-0.5"
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
              <a href="#roadmaps" className="hover:text-white transition-colors">
                Roadmaps
              </a>
              <a href="#notebooks" className="hover:text-white transition-colors">
                Notebooks
              </a>
              <a href="#doc-intelligence" className="hover:text-white transition-colors">
                Doc Intelligence
              </a>
              <a href="#tasks-goals" className="hover:text-white transition-colors">
                Tasks & Goals
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
