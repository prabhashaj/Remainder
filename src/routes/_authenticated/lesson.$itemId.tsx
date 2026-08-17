import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BookOpenCheck, Clock, Layers, ListPlus, Play, RefreshCw, Sparkle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { MessageResponse } from "@/components/ai-elements/message";
import { SpeechAndCopyToolbar } from "@/components/speech-and-copy";
import { Button } from "@/components/ui/button";
import { ExpandableImage } from "@/components/ui/expandable-image";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createTask, fetchRoadmapItem, fetchTasks, today, updateRoadmapItem } from "@/lib/db";
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

  const { data: item, isLoading } = useQuery({
    queryKey: ["roadmap-item", itemId],
    queryFn: () => fetchRoadmapItem(itemId),
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

  return (
    <div className="mx-auto max-w-3xl px-5 pb-32 pt-8 sm:px-8">
      <Link
        to="/roadmap/$roadmapId"
        params={{ roadmapId: item.roadmap_id }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to roadmap
      </Link>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-primary">
        {item.phase}
      </p>
      <h1 className="mt-1.5 font-display text-3xl font-bold">{item.title}</h1>
      {item.detail && <p className="mt-2 leading-relaxed text-muted-foreground">{item.detail}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-4">
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
                  ? `Flashcards (${cardCount})`
                  : "Generate flashcards"}
            </Button>
          </>
        )}
      </div>

      <QuizModal
        itemId={item.id}
        itemTitle={item.title}
        open={quizOpen}
        onOpenChange={setQuizOpen}
      />

      <Dialog open={flashcardsOpen} onOpenChange={setFlashcardsOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-bold">
              Flashcards: {item.title}
            </DialogTitle>
          </DialogHeader>
          <FlashcardReview itemId={item.id} onComplete={() => setFlashcardsOpen(false)} />
        </DialogContent>
      </Dialog>

      {generating && !hasContent ? (
        <div className="panel-soft mt-8 px-6 py-12 text-center">
          <Sparkle className="mx-auto size-6 animate-pulse text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            Remi is researching and writing this lesson…
          </p>
        </div>
      ) : hasContent ? (
        <article className="mt-8">
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
        <section className="mt-10">
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
        <section className="mt-10">
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
  );
}
