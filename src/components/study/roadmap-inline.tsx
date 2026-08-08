import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Sparkle,
} from "lucide-react";
import { useState } from "react";

import { MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  fetchRoadmapItems,
  updateRoadmapItem,
  type RoadmapItem,
  type Roadmap,
} from "@/lib/db";
import { generateLesson } from "@/lib/lesson.functions";

/**
 * An inline, expandable roadmap viewer for the study page.
 * Shows phases → topics → subtopics with collapsible lesson content.
 * The user never needs to navigate away from the study page.
 */
export function RoadmapInline({
  roadmap,
  items,
}: {
  roadmap: Roadmap;
  items: RoadmapItem[];
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(
    new Set(),
  );

  const toggle = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      updateRoadmapItem(id, { done }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["roadmap-items"] });
    },
  });

  const roadmapItems = items.filter((i) => i.roadmap_id === roadmap.id);
  const topics = roadmapItems.filter((i) => !i.parent_id);
  const subsFor = (id: string) =>
    roadmapItems.filter((i) => i.parent_id === id);

  const done = roadmapItems.filter((i) => i.done && i.parent_id).length;
  const total = roadmapItems.filter((i) => i.parent_id).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const phases = topics.reduce<Record<string, RoadmapItem[]>>((acc, item) => {
    const list = acc[item.phase] ?? [];
    list.push(item);
    acc[item.phase] = list;
    return acc;
  }, {});

  const toggleTopic = (id: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleLesson = (id: string) => {
    setExpandedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="card-soft overflow-hidden">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-muted/30"
      >
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold">
            <BookOpen className="size-4 shrink-0 text-primary" />
            {roadmap.topic}
          </h3>
          <div className="mt-2 flex items-center gap-3">
            <Progress value={pct} className="h-1.5 flex-1 rounded-full" />
            <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
              {done}/{total}
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="size-5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-5 pb-5 pt-3">
          {roadmap.summary && (
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              {roadmap.summary}
            </p>
          )}

          <div className="space-y-6">
            {Object.entries(phases).map(([phase, phaseTopics]) => (
              <section key={phase}>
                <h4 className="font-display text-xs font-bold uppercase tracking-wide text-primary">
                  {phase}
                </h4>
                <div className="mt-2 space-y-2">
                  {phaseTopics.map((topic) => {
                    const subs = subsFor(topic.id);
                    const isTopicExpanded = expandedTopics.has(topic.id);

                    return (
                      <div
                        key={topic.id}
                        className="rounded-2xl border border-border/60"
                      >
                        {/* Topic header */}
                        <button
                          type="button"
                          onClick={() => toggleTopic(topic.id)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
                        >
                          <Checkbox
                            checked={topic.done}
                            onCheckedChange={(v) => {
                              toggle.mutate({
                                id: topic.id,
                                done: Boolean(v),
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5 rounded-md"
                          />
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm font-medium ${topic.done ? "text-muted-foreground line-through" : ""}`}
                            >
                              {topic.title}
                            </p>
                            {topic.estimated_minutes && (
                              <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="size-3" />~
                                {topic.estimated_minutes} min
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {subs.filter((s) => s.done).length}/{subs.length}
                          </span>
                          {isTopicExpanded ? (
                            <ChevronDown className="size-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-4 text-muted-foreground" />
                          )}
                        </button>

                        {/* Sub-topics */}
                        {isTopicExpanded && subs.length > 0 && (
                          <div className="border-t border-border/40 px-4 pb-3 pt-2">
                            <ul className="space-y-1">
                              {subs.map((sub) => {
                                const isLessonExpanded = expandedLessons.has(
                                  sub.id,
                                );
                                return (
                                  <li key={sub.id}>
                                    <div className="rounded-xl transition-colors hover:bg-muted/40">
                                      <button
                                        type="button"
                                        onClick={() => toggleLesson(sub.id)}
                                        className="flex w-full items-start gap-2.5 px-2 py-2 text-left"
                                      >
                                        <Checkbox
                                          checked={sub.done}
                                          onCheckedChange={(v) =>
                                            toggle.mutate({
                                              id: sub.id,
                                              done: Boolean(v),
                                            })
                                          }
                                          onClick={(e) => e.stopPropagation()}
                                          className="mt-0.5 rounded-md"
                                        />
                                        <div className="min-w-0 flex-1">
                                          <p
                                            className={`text-sm font-medium ${sub.done ? "text-muted-foreground line-through" : ""}`}
                                          >
                                            {sub.title}
                                          </p>
                                          {sub.detail && (
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                              {sub.detail}
                                            </p>
                                          )}
                                        </div>
                                        <span className="mt-0.5 text-xs text-primary">
                                          {isLessonExpanded
                                            ? "Collapse"
                                            : sub.content
                                              ? "Read"
                                              : "Open"}
                                        </span>
                                      </button>

                                      {/* Inline lesson content */}
                                      {isLessonExpanded && (
                                        <div className="px-2 pb-3">
                                          <InlineLessonContent item={sub} />
                                        </div>
                                      )}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Shows lesson content inline, or triggers generation if not yet written.
 */
function InlineLessonContent({ item }: { item: RoadmapItem }) {
  const qc = useQueryClient();
  const runLesson = useServerFn(generateLesson);

  const generate = useMutation({
    mutationFn: (force: boolean) =>
      runLesson({ data: { itemId: item.id, force } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["roadmap-items"] });
    },
  });

  // Auto-generate if no content
  if (!item.content && !generate.isPending && !generate.isSuccess) {
    return (
      <div className="rounded-xl bg-muted/40 px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          {(generate.data as { error?: string } | undefined)?.error ??
            "No lesson written yet."}
        </p>
        <Button
          size="sm"
          className="press mt-3 gap-1.5 rounded-2xl"
          onClick={() => generate.mutate(false)}
        >
          <Sparkle className="size-3.5" /> Generate lesson
        </Button>
      </div>
    );
  }

  if (generate.isPending) {
    return (
      <div className="rounded-xl bg-muted/40 px-4 py-8 text-center">
        <Loader2 className="mx-auto size-5 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">
          Writing this lesson…
        </p>
      </div>
    );
  }

  if (item.content) {
    return (
      <div className="rounded-xl border border-border/40 bg-background p-4">
        <div className="prose-sm max-h-96 overflow-y-auto">
          <MessageResponse>{item.content}</MessageResponse>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 gap-1 text-xs text-muted-foreground"
          onClick={() => generate.mutate(true)}
          disabled={generate.isPending}
        >
          <Sparkle className="size-3" /> Regenerate
        </Button>
      </div>
    );
  }

  return null;
}
