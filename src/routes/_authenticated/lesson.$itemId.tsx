import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Expand,
  Layers,
  ListPlus,
  Maximize2,
  Minimize2,
  Play,
  RefreshCw,
  Shrink,
  Sparkle,
  Type,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { MessageResponse } from "@/components/ai-elements/message";
import { SpeechAndCopyToolbar } from "@/components/speech-and-copy";
import { Button } from "@/components/ui/button";
import { ExpandableImage } from "@/components/ui/expandable-image";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  createTask,
  fetchRoadmapItem,
  fetchRoadmapItems,
  fetchTasks,
  today,
  updateRoadmapItem,
  type RoadmapItem,
} from "@/lib/db";
import { generateLesson } from "@/lib/lesson.functions";
import { generateFlashcardsForItem, fetchFlashcardCountForItem } from "@/lib/srs.functions";
import { useRegisterTopic } from "@/lib/topic-context";
import { useFocusTimer } from "@/components/focus-timer";
import { QuizModal } from "@/components/quiz-modal";
import { CheckpointGate } from "@/components/checkpoint-gate";
import { FlashcardReview } from "@/components/flashcard-review";
import { extractYouTubeId, getYouTubeEmbedUrl, getYouTubeWatchUrl } from "@/lib/youtube";
import type { LessonImage, LessonVideo } from "@/lib/agents/curriculum.server";

export const Route = createFileRoute("/_authenticated/lesson/$itemId")({
  head: () => ({
    meta: [
      { title: "Lesson — Remispace" },
      {
        name: "description",
        content:
          "A researched lesson for this sub-topic, with visuals and videos for further study.",
      },
      { property: "og:title", content: "Lesson — Remispace" },
      {
        property: "og:description",
        content: "Read, look, and watch — everything for this sub-topic in one place.",
      },
    ],
  }),
  component: LessonPage,
});

function LessonPage() {
  const { itemId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const runLesson = useServerFn(generateLesson);
  const runGenerateFlashcards = useServerFn(generateFlashcardsForItem);
  const runFetchCardCount = useServerFn(fetchFlashcardCountForItem);
  const { start: startTimer } = useFocusTimer();

  const [quizOpen, setQuizOpen] = useState(false);
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState<"normal" | "large" | "extra">("large");
  const [readingWidth, setReadingWidth] = useState<"compact" | "balanced" | "wide">("balanced");
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const fullscreenContainerRef = useRef<HTMLDivElement>(null);

  const { data: item, isLoading } = useQuery({
    queryKey: ["roadmap-item", itemId],
    queryFn: () => fetchRoadmapItem(itemId),
  });

  const { data: roadmapItems = [] } = useQuery({
    queryKey: ["roadmap-items", item?.roadmap_id],
    queryFn: () => (item?.roadmap_id ? fetchRoadmapItems(item.roadmap_id) : Promise.resolve([])),
    enabled: Boolean(item?.roadmap_id),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
  });

  const { data: flashcardData } = useQuery({
    queryKey: ["flashcard-count-item", itemId],
    queryFn: () => runFetchCardCount({ data: { itemId } }),
    enabled: Boolean(item?.content),
  });

  // Calculate previous and next subtopics for sequential reading
  const allSubtopics = roadmapItems.filter((i) => Boolean(i.parent_id));
  const currentIndex = allSubtopics.findIndex((i) => i.id === itemId);
  const prevSubtopic = currentIndex > 0 ? allSubtopics[currentIndex - 1] : null;
  const nextSubtopic =
    currentIndex >= 0 && currentIndex < allSubtopics.length - 1
      ? allSubtopics[currentIndex + 1]
      : null;

  // Keyboard shortcut listener (Esc to exit fullscreen)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Scroll progress listener for fullscreen reader
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const totalHeight = target.scrollHeight - target.clientHeight;
    if (totalHeight > 0) {
      const progress = Math.min(100, Math.max(0, (target.scrollTop / totalHeight) * 100));
      setScrollProgress(progress);
    }
    setShowScrollTop(target.scrollTop > 400);
  };

  const scrollToTop = () => {
    fullscreenContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const addTask = useMutation({
    mutationFn: async (lessonTitle: string) => {
      return createTask({
        title: `Study: ${lessonTitle}`,
        due_date: today(),
      });
    },
    onSuccess: (newTask) => {
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(`Added "${newTask.title}" to today's tasks!`, {
        action: {
          label: "View Tasks",
          onClick: () => navigate({ to: "/tasks" }),
        },
      });
    },
  });

  const isTaskScheduled = item
    ? tasks.some(
        (t) =>
          (t.title.toLowerCase() === `study: ${item.title}`.toLowerCase() ||
            t.title.toLowerCase() === item.title.toLowerCase()) &&
          !t.done,
      )
    : false;

  const generate = useMutation({
    mutationFn: (force: boolean) => runLesson({ data: { itemId, force } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["roadmap-item", itemId] });
      void qc.invalidateQueries({ queryKey: ["roadmap-items"] });
    },
  });

  const makeFlashcards = useMutation({
    mutationFn: () => runGenerateFlashcards({ data: { itemId } }),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`Generated ${res.count ?? 0} flashcards for review!`);
        void qc.invalidateQueries({ queryKey: ["flashcard-count-item", itemId] });
        void qc.invalidateQueries({ queryKey: ["flashcards-item", itemId] });
        void qc.invalidateQueries({ queryKey: ["due-flashcards"] });
        void qc.invalidateQueries({ queryKey: ["due-flashcard-count"] });
        setFlashcardsOpen(true);
      } else {
        toast.error(res.error || "Failed to generate flashcards.");
      }
    },
  });

  const toggleDone = useMutation({
    mutationFn: (done: boolean) => updateRoadmapItem(itemId, { done }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["roadmap-item", itemId] });
      void qc.invalidateQueries({ queryKey: ["roadmap-items"] });
    },
  });

  const hasContent = Boolean(item?.content);
  const generating = generate.isPending;
  const cardCount = flashcardData?.count ?? 0;

  // Let the Remi dock answer doubts about exactly this sub-topic.
  useRegisterTopic(item ? { itemId: item.id, label: item.title } : null);

  // Auto-write the lesson the first time a learner opens this sub-topic.
  useEffect(() => {
    if (!item || hasContent || generate.isPending || generate.isSuccess) return;
    generate.mutate(false);
  }, [item, hasContent, generate]);

  const images = (item?.images ?? []) as LessonImage[];
  const videos = (item?.video_links ?? []) as LessonVideo[];

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-12 text-sm text-muted-foreground">
        Loading lesson…
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-12">
        <p className="text-sm text-muted-foreground">This lesson doesn’t exist.</p>
        <Button asChild className="press mt-4 rounded-2xl">
          <Link to="/roadmaps">Back to roadmaps</Link>
        </Button>
      </div>
    );
  }

  const fontSizeClass =
    fontSize === "normal"
      ? "text-[15px] sm:text-base leading-relaxed"
      : fontSize === "extra"
        ? "text-lg sm:text-xl leading-loose"
        : "text-[17px] sm:text-lg leading-relaxed";

  const widthContainerClass =
    readingWidth === "compact"
      ? "max-w-2xl"
      : readingWidth === "wide"
        ? "max-w-5xl"
        : "max-w-3xl";

  const articleContent = (
    <>
      {generating && !hasContent ? (
        <div className="panel-soft mt-8 px-6 py-12 text-center">
          <Sparkle className="mx-auto size-6 animate-pulse text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            Remi is researching and writing this lesson…
          </p>
        </div>
      ) : hasContent ? (
        <article className={`mt-8 ${fontSizeClass}`}>
          <MessageResponse>{item.content ?? ""}</MessageResponse>
          <SpeechAndCopyToolbar
            text={item.content ?? ""}
            id={`lesson-${item.id}`}
            className="mt-4"
          />
        </article>
      ) : (
        <div className="panel-soft mt-8 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {generate.data && "error" in generate.data && generate.data.error
              ? generate.data.error
              : "No lesson written yet."}
          </p>
          <Button className="press mt-4 rounded-2xl" onClick={() => generate.mutate(true)}>
            Write this lesson
          </Button>
        </div>
      )}

      {images.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-primary">
            Key Visuals & Diagrams
          </h2>
          <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2">
            {images.slice(0, 2).map((img) => (
              <ExpandableImage
                key={img.url}
                src={img.url}
                alt={img.caption ?? `${item.title} visual illustration`}
                caption={img.caption ?? "Visual concept diagram"}
                imageClassName="h-48 sm:h-56 w-full object-cover"
                containerClassName="w-full shadow-soft"
              />
            ))}
          </div>
        </section>
      )}

      {videos.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-primary">
            Top Video Resources
          </h2>
          <div className="mt-4 space-y-5">
            {videos.slice(0, 2).map((v) => {
              const vid = extractYouTubeId(v.youtube_id || v.url);
              const watchUrl = vid ? getYouTubeWatchUrl(vid) : v.url;
              return (
                <div
                  key={v.url}
                  className="w-full overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-all hover:shadow-lift"
                >
                  {vid ? (
                    <iframe
                      src={getYouTubeEmbedUrl(vid)}
                      title={v.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                      className="aspect-video w-full border-0"
                    />
                  ) : null}
                  <a
                    href={watchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 p-4 text-sm font-semibold hover:bg-muted/50 transition-colors"
                  >
                    <Play className="size-4 text-primary shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{v.title}</span>
                  </a>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );

  return (
    <>
      {/* ── Normal Embedded View ── */}
      <div className="mx-auto max-w-3xl px-5 pb-32 pt-8 sm:px-8">
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/roadmap/$roadmapId"
            params={{ roadmapId: item.roadmap_id }}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" /> Back to roadmap
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen(true)}
            className="press gap-1.5 rounded-2xl border-border/80 bg-background/80 hover:bg-accent shadow-xs"
            title="Read in distraction-free full screen mode"
          >
            <Maximize2 className="size-3.5 text-primary" />
            <span className="text-xs font-semibold">Full screen</span>
          </Button>
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-primary">
          {item.phase}
        </p>
        <h1 className="mt-1.5 font-display text-3xl sm:text-4xl font-bold tracking-tight">
          {item.title}
        </h1>
        {item.detail && (
          <p className="mt-2 leading-relaxed text-muted-foreground">{item.detail}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <CheckpointGate
            itemId={item.id}
            isDone={item.done}
            onToggleDone={(d) => toggleDone.mutate(d)}
          />

          {item.estimated_minutes ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3" />~{item.estimated_minutes} min
            </span>
          ) : null}

          <Button
            variant="outline"
            size="sm"
            className="press rounded-2xl"
            onClick={() => startTimer(item.estimated_minutes || 25, item.title, item.id)}
          >
            Focus on this
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => addTask.mutate(item.title)}
            disabled={item.done || isTaskScheduled || addTask.isPending}
            className={`press rounded-2xl gap-1.5 ${
              isTaskScheduled ? "bg-primary/10 text-primary border-primary/30" : ""
            }`}
          >
            <ListPlus className="size-3.5 text-primary" />
            {isTaskScheduled ? "Scheduled in tasks" : "Add to tasks"}
          </Button>

          {hasContent && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="press rounded-2xl gap-1.5"
                onClick={() => setQuizOpen(true)}
              >
                <BookOpenCheck className="size-3.5 text-primary" /> Test yourself
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="press rounded-2xl gap-1.5"
                disabled={makeFlashcards.isPending}
                onClick={() => {
                  if (cardCount > 0) {
                    setFlashcardsOpen(true);
                  } else {
                    makeFlashcards.mutate();
                  }
                }}
              >
                <Layers className="size-3.5 text-primary" />
                {makeFlashcards.isPending
                  ? "Creating cards…"
                  : cardCount > 0
                    ? `Flashcards (${Math.min(cardCount, 5)})`
                    : "Generate flashcards"}
              </Button>
            </>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsFullscreen(true)}
            className="press rounded-2xl gap-1.5"
            title="Read in full screen"
          >
            <Maximize2 className="size-3.5 text-primary" />
            Full screen
          </Button>
        </div>

        {articleContent}

        {hasContent && (
          <Button
            variant="ghost"
            size="sm"
            className="press mt-8 gap-1.5 rounded-2xl text-muted-foreground"
            onClick={() => generate.mutate(true)}
            disabled={generating}
          >
            <RefreshCw className={`size-3.5 ${generating ? "animate-spin" : ""}`} />
            Regenerate with fresh research
          </Button>
        )}
      </div>

      {/* ── Dedicated Full-Screen Reading Mode ── */}
      {isFullscreen && (
        <div
          ref={fullscreenContainerRef}
          onScroll={handleScroll}
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background text-foreground animate-in fade-in duration-200"
        >
          {/* Scroll Progress Bar at the top */}
          <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-muted/40">
            <div
              className="h-full bg-gradient-to-r from-primary via-amber-500 to-primary transition-all duration-150 ease-out"
              style={{ width: `${scrollProgress}%` }}
            />
          </div>

          {/* Sticky Fullscreen Top Navigation Bar */}
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border/70 bg-background/90 px-4 sm:px-8 backdrop-blur-md">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(false)}
                className="press rounded-2xl gap-1.5 text-muted-foreground hover:text-foreground"
                title="Exit full screen (Esc)"
              >
                <Minimize2 className="size-4 text-primary" />
                <span className="hidden sm:inline font-medium text-xs">Exit Full Screen</span>
                <kbd className="hidden sm:inline-block rounded border border-border/80 bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  Esc
                </kbd>
              </Button>

              <div className="hidden md:flex items-center gap-2 border-l border-border/60 pl-3">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                  {item.phase}
                </span>
                <span className="truncate max-w-xs text-sm font-semibold">{item.title}</span>
              </div>
            </div>

            {/* Reading Controls & Actions */}
            <div className="flex items-center gap-2">
              {/* Font Size Adjuster */}
              <div className="flex items-center rounded-2xl border border-border/60 bg-muted/40 p-0.5">
                <button
                  type="button"
                  onClick={() =>
                    setFontSize((s) => (s === "extra" ? "large" : s === "large" ? "normal" : "normal"))
                  }
                  title="Smaller text"
                  className={`rounded-xl px-2 py-1 text-xs font-semibold transition-colors ${
                    fontSize === "normal"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  A-
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFontSize((s) => (s === "normal" ? "large" : s === "large" ? "extra" : "extra"))
                  }
                  title="Larger text"
                  className={`rounded-xl px-2 py-1 text-xs font-semibold transition-colors ${
                    fontSize === "extra"
                      ? "bg-background text-foreground shadow-2xs"
                      : fontSize === "large"
                        ? "bg-background text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  A+
                </button>
              </div>

              {/* Reading Width Selector */}
              <div className="hidden sm:flex items-center rounded-2xl border border-border/60 bg-muted/40 p-0.5">
                <button
                  type="button"
                  onClick={() => setReadingWidth("compact")}
                  title="Compact reading width"
                  className={`rounded-xl px-2 py-1 text-xs font-medium transition-colors ${
                    readingWidth === "compact"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Compact
                </button>
                <button
                  type="button"
                  onClick={() => setReadingWidth("balanced")}
                  title="Balanced reading width"
                  className={`rounded-xl px-2 py-1 text-xs font-medium transition-colors ${
                    readingWidth === "balanced"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Balanced
                </button>
                <button
                  type="button"
                  onClick={() => setReadingWidth("wide")}
                  title="Wide reading width"
                  className={`rounded-xl px-2 py-1 text-xs font-medium transition-colors ${
                    readingWidth === "wide"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Wide
                </button>
              </div>

              {hasContent && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden lg:flex press rounded-2xl gap-1.5 text-xs"
                    onClick={() => setQuizOpen(true)}
                  >
                    <BookOpenCheck className="size-3.5 text-primary" /> Test yourself
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden lg:flex press rounded-2xl gap-1.5 text-xs"
                    disabled={makeFlashcards.isPending}
                    onClick={() => {
                      if (cardCount > 0) {
                        setFlashcardsOpen(true);
                      } else {
                        makeFlashcards.mutate();
                      }
                    }}
                  >
                    <Layers className="size-3.5 text-primary" />
                    {cardCount > 0 ? `Cards (${Math.min(cardCount, 5)})` : "Flashcards"}
                  </Button>
                </>
              )}

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsFullscreen(false)}
                className="rounded-2xl text-muted-foreground hover:text-foreground"
                aria-label="Close fullscreen"
              >
                <Minimize2 className="size-4" />
              </Button>
            </div>
          </header>

          {/* Fullscreen Reading Canvas */}
          <main className={`mx-auto w-full ${widthContainerClass} px-6 py-12 sm:px-10 pb-36`}>
            <div className="flex items-center justify-between gap-4 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                {item.phase}
              </span>
              <div className="flex items-center gap-2">
                <CheckpointGate
                  itemId={item.id}
                  isDone={item.done}
                  onToggleDone={(d) => toggleDone.mutate(d)}
                />
                {item.estimated_minutes ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" />~{item.estimated_minutes} min
                  </span>
                ) : null}
              </div>
            </div>

            <h1 className="mt-2 font-display text-3xl sm:text-5xl font-extrabold tracking-tight">
              {item.title}
            </h1>
            {item.detail && (
              <p className="mt-3 text-base sm:text-lg leading-relaxed text-muted-foreground">
                {item.detail}
              </p>
            )}

            {/* Quick Action Pill Bar */}
            <div className="mt-6 flex flex-wrap items-center gap-2.5 pt-4 border-t border-border/40">
              <Button
                variant="outline"
                size="sm"
                className="press rounded-2xl gap-1.5 text-xs"
                onClick={() => startTimer(item.estimated_minutes || 25, item.title, item.id)}
              >
                Focus timer
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => addTask.mutate(item.title)}
                disabled={item.done || isTaskScheduled || addTask.isPending}
                className={`press rounded-2xl gap-1.5 text-xs ${
                  isTaskScheduled ? "bg-primary/10 text-primary border-primary/30" : ""
                }`}
              >
                <ListPlus className="size-3.5 text-primary" />
                {isTaskScheduled ? "Scheduled in tasks" : "Add to tasks"}
              </Button>

              {hasContent && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="press rounded-2xl gap-1.5 text-xs"
                    onClick={() => setQuizOpen(true)}
                  >
                    <BookOpenCheck className="size-3.5 text-primary" /> Test yourself
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="press rounded-2xl gap-1.5 text-xs"
                    disabled={makeFlashcards.isPending}
                    onClick={() => {
                      if (cardCount > 0) {
                        setFlashcardsOpen(true);
                      } else {
                        makeFlashcards.mutate();
                      }
                    }}
                  >
                    <Layers className="size-3.5 text-primary" />
                    {cardCount > 0 ? `Flashcards (${Math.min(cardCount, 5)})` : "Flashcards"}
                  </Button>
                </>
              )}
            </div>

            {articleContent}

            {/* Previous / Next Subtopic Navigation Footer in Fullscreen */}
            <div className="mt-16 pt-8 border-t border-border/60 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {prevSubtopic ? (
                <Link
                  to="/lesson/$itemId"
                  params={{ itemId: prevSubtopic.id }}
                  className="card-soft group p-4 flex items-center gap-3 transition-all hover:shadow-soft"
                >
                  <ChevronLeft className="size-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Previous sub-topic</p>
                    <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                      {prevSubtopic.title}
                    </p>
                  </div>
                </Link>
              ) : (
                <div />
              )}

              {nextSubtopic ? (
                <Link
                  to="/lesson/$itemId"
                  params={{ itemId: nextSubtopic.id }}
                  className="card-soft group p-4 flex items-center justify-between gap-3 text-right transition-all hover:shadow-soft sm:col-start-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Next sub-topic</p>
                    <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                      {nextSubtopic.title}
                    </p>
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </Link>
              ) : null}
            </div>
          </main>

          {/* Floating Scroll-to-Top Button */}
          {showScrollTop && (
            <button
              type="button"
              onClick={scrollToTop}
              aria-label="Scroll to top"
              className="press fixed bottom-8 right-8 z-40 flex size-11 items-center justify-center rounded-full bg-card border border-border shadow-lg text-muted-foreground hover:text-foreground transition-transform hover:scale-110"
            >
              <ArrowUp className="size-5" />
            </button>
          )}
        </div>
      )}

      {/* ── Modals & Dialogs ── */}
      <QuizModal
        itemId={item.id}
        itemTitle={item.title}
        open={quizOpen}
        onOpenChange={setQuizOpen}
      />

      <Dialog open={flashcardsOpen} onOpenChange={setFlashcardsOpen}>
        <DialogContent className="rounded-3xl sm:max-w-lg p-6">
          <DialogHeader className="pb-1">
            <DialogTitle className="font-display text-lg font-bold">
              Flashcards: {item.title}
            </DialogTitle>
          </DialogHeader>
          <FlashcardReview itemId={item.id} onComplete={() => setFlashcardsOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
