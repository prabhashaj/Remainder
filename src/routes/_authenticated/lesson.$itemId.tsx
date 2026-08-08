import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Clock, Play, RefreshCw, Sparkle } from "lucide-react";
import { useEffect } from "react";

import { MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ExpandableImage } from "@/components/ui/expandable-image";
import { fetchRoadmapItem, updateRoadmapItem } from "@/lib/db";
import { generateLesson } from "@/lib/lesson.functions";
import { useRegisterTopic } from "@/lib/topic-context";
import { useFocusTimer } from "@/components/focus-timer";
import type { LessonImage, LessonVideo } from "@/lib/agents/curriculum.server";

export const Route = createFileRoute("/_authenticated/lesson/$itemId")({
  head: () => ({
    meta: [
      { title: "Lesson — Remainder" },
      {
        name: "description",
        content:
          "A researched lesson for this sub-topic, with visuals and videos for further study.",
      },
      { property: "og:title", content: "Lesson — Remainder" },
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
  const runLesson = useServerFn(generateLesson);
  const { start: startTimer } = useFocusTimer();


  const { data: item, isLoading } = useQuery({
    queryKey: ["roadmap-item", itemId],
    queryFn: () => fetchRoadmapItem(itemId),
  });

  const generate = useMutation({
    mutationFn: (force: boolean) => runLesson({ data: { itemId, force } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["roadmap-item", itemId] });
      void qc.invalidateQueries({ queryKey: ["roadmap-items"] });
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
      {item.detail && (
        <p className="mt-2 leading-relaxed text-muted-foreground">{item.detail}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={item.done}
            onCheckedChange={(v) => toggleDone.mutate(Boolean(v))}
            className="rounded-md"
          />
          Mark as learned
        </label>
        {item.estimated_minutes ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />~{item.estimated_minutes} min
          </span>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          className="press rounded-2xl"
          onClick={() =>
            startTimer(item.estimated_minutes || 25, item.title, item.id)
          }
        >
          Focus on this
        </Button>
      </div>


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
        </article>
      ) : (
        <div className="panel-soft mt-8 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {generate.data && "error" in generate.data && generate.data.error
              ? generate.data.error
              : "No lesson written yet."}
          </p>
          <Button
            className="press mt-4 rounded-2xl"
            onClick={() => generate.mutate(true)}
          >
            Write this lesson
          </Button>
        </div>
      )}

      {images.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-primary">
            Visuals
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {images.map((img) => (
              <ExpandableImage
                key={img.url}
                src={img.url}
                alt={img.caption ?? `${item.title} illustration`}
                caption={img.caption}
                imageClassName="h-48 w-full object-cover"
              />
            ))}
          </div>
        </section>
      )}

      {videos.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-primary">
            Keep going — videos
          </h2>
          <div className="mt-3 space-y-3">
            {videos.map((v) => (
              <div
                key={v.url}
                className="overflow-hidden rounded-3xl border border-border"
              >
                {v.youtube_id ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${v.youtube_id}`}
                    title={v.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                    className="aspect-video w-full"
                  />
                ) : null}
                <a
                  href={v.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-muted/50"
                >
                  <Play className="size-3.5 text-primary" />
                  <span className="min-w-0 flex-1 truncate">{v.title}</span>
                </a>
              </div>
            ))}
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
