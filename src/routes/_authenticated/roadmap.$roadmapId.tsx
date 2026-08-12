import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Clock,
  ExternalLink,
  Search,
  Sparkle,
} from "lucide-react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  checkAndRecordRoadmapCompletion,
  fetchRoadmap,
  fetchRoadmapItems,
  fetchRoadmapResources,
  updateRoadmapItem,
  type RoadmapItem,
} from "@/lib/db";

export const Route = createFileRoute("/_authenticated/roadmap/$roadmapId")({
  head: () => ({
    meta: [
      { title: "Learning roadmap — Remispace" },
      {
        name: "description",
        content:
          "A detailed learning roadmap with phases, topics, sub-topic lessons, images and videos.",
      },
      { property: "og:title", content: "Learning roadmap — Remispace" },
      {
        property: "og:description",
        content: "Phases, topics and full lessons for every sub-topic.",
      },
    ],
  }),
  component: RoadmapDetail,
});

function RoadmapDetail() {
  const { roadmapId } = Route.useParams();
  const qc = useQueryClient();

  const { data: roadmap } = useQuery({
    queryKey: ["roadmap", roadmapId],
    queryFn: () => fetchRoadmap(roadmapId),
  });
  const { data: items = [] } = useQuery({
    queryKey: ["roadmap-items", roadmapId],
    queryFn: () => fetchRoadmapItems(roadmapId),
  });
  const { data: resources = [] } = useQuery({
    queryKey: ["roadmap-resources", roadmapId],
    queryFn: () => fetchRoadmapResources(roadmapId),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const updated = await updateRoadmapItem(id, { done });
      if (done && roadmapId) {
        const newlyMastered = await checkAndRecordRoadmapCompletion(roadmapId);
        if (newlyMastered) {
          toast.success(`🎉 Skill Mastered! Remi saved "${roadmap?.topic ?? "this roadmap"}" as a completed skill in your memory!`, {
            duration: 6000,
          });
        }
      }
      return updated;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["roadmap-items", roadmapId] }),
  });

  const topics = items.filter((i) => !i.parent_id);
  const subsFor = (id: string) => items.filter((i) => i.parent_id === id);

  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  const phases = topics.reduce<Record<string, RoadmapItem[]>>((acc, item) => {
    const list = acc[item.phase] ?? [];
    list.push(item);
    acc[item.phase] = list;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-4xl px-5 pb-32 pt-8 sm:px-8">
      <Link
        to="/roadmaps"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All roadmaps
      </Link>

      <h1 className="mt-4 font-display text-3xl font-bold">{roadmap?.topic ?? "Roadmap"}</h1>
      {roadmap?.summary && (
        <p className="mt-2 leading-relaxed text-muted-foreground">{roadmap.summary}</p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <Progress value={pct} className="h-2.5 rounded-full" />
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {done}/{items.length} done
        </span>
      </div>

      <div className="mt-8 space-y-8">
        {Object.entries(phases).map(([phase, phaseTopics]) => (
          <section key={phase}>
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-primary">
              {phase}
            </h2>
            <div className="mt-3 space-y-4">
              {phaseTopics.map((topic) => (
                <article key={topic.id} className="card-soft p-5">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={topic.done}
                      onCheckedChange={(v) => toggle.mutate({ id: topic.id, done: Boolean(v) })}
                      className="mt-1 rounded-md"
                    />
                    <div className="min-w-0 flex-1">
                      <h3
                        className={`font-display text-base font-semibold ${topic.done ? "text-muted-foreground line-through" : ""}`}
                      >
                        {topic.title}
                      </h3>
                      {topic.detail && (
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {topic.detail}
                        </p>
                      )}
                      {topic.estimated_minutes ? (
                        <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />~{topic.estimated_minutes} min
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <ul className="mt-3 space-y-1">
                    {subsFor(topic.id).map((sub) => (
                      <li key={sub.id}>
                        <div className="flex items-start gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-muted/50">
                          <Checkbox
                            checked={sub.done}
                            onCheckedChange={(v) => toggle.mutate({ id: sub.id, done: Boolean(v) })}
                            className="mt-0.5 rounded-md"
                          />
                          <Link
                            to="/lesson/$itemId"
                            params={{ itemId: sub.id }}
                            className="min-w-0 flex-1"
                          >
                            <p
                              className={`text-sm font-medium ${sub.done ? "text-muted-foreground line-through" : ""}`}
                            >
                              {sub.title}
                            </p>
                            {sub.detail && (
                              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                                {sub.detail}
                              </p>
                            )}
                            <span className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
                              {sub.content ? "Read the lesson" : "Open lesson"}
                              <ChevronRight className="size-3" />
                            </span>
                          </Link>
                        </div>
                      </li>
                    ))}
                    {subsFor(topic.id).length === 0 && (
                      <li className="px-2 text-xs text-muted-foreground">
                        No sub-topics yet — ask Remi to expand this topic.
                      </li>
                    )}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      {resources.length > 0 && (
        <section className="mt-10">
          <h2 className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide text-primary">
            <BookOpen className="size-4" /> Resource library
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {resources.map((res) => (
              <Link
                key={res.id}
                to="/resource/$resourceId"
                params={{ resourceId: res.id }}
                className="press flex items-start gap-3 rounded-2xl border border-border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{res.title}</p>
                  <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
                    {res.kind}
                  </span>
                </div>
                <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        <Button asChild variant="outline" className="press gap-1.5 rounded-2xl">
          <Link
            to="/conversation"
            search={{
              seed: `Find the best current tutorials and videos for my ${roadmap?.topic ?? "roadmap"} roadmap`,
            }}
          >
            <Search className="size-4" /> Find tutorials
          </Link>
        </Button>
        <Button asChild variant="outline" className="press gap-1.5 rounded-2xl">
          <Link
            to="/conversation"
            search={{
              seed: `Add more advanced phases and sub-topics to my ${roadmap?.topic ?? "roadmap"} roadmap`,
            }}
          >
            <Sparkle className="size-4" /> Deepen this roadmap
          </Link>
        </Button>
      </div>
    </div>
  );
}
