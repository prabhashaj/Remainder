import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Compass, Layers, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { deleteRoadmap, fetchRoadmapItems, fetchRoadmaps, type Roadmap } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/roadmaps")({
  head: () => ({
    meta: [
      { title: "Roadmaps — Remainder" },
      {
        name: "description",
        content: "Learning paths Remi built for you, phase by phase.",
      },
      { property: "og:title", content: "Roadmaps — Remainder" },
      {
        property: "og:description",
        content: "Your AI-built learning roadmaps in Remainder.",
      },
    ],
  }),
  component: RoadmapsPage,
});

function RoadmapsPage() {
  const qc = useQueryClient();
  const { data: roadmaps = [] } = useQuery({
    queryKey: ["roadmaps"],
    queryFn: fetchRoadmaps,
  });
  const remove = useMutation({
    mutationFn: deleteRoadmap,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["roadmaps"] }),
  });

  return (
    <div className="mx-auto max-w-4xl px-5 pb-32 pt-8 sm:px-8">
      <h1 className="font-display text-3xl font-bold">Roadmaps</h1>
      <p className="mt-2 text-muted-foreground">
        Ask Remi to plan a topic and it shows up here, ready to work through.
      </p>

      <div className="mt-7 space-y-4">
        {roadmaps.map((roadmap) => (
          <RoadmapCard
            key={roadmap.id}
            roadmap={roadmap}
            onDelete={() => remove.mutate(roadmap.id)}
          />
        ))}
        {roadmaps.length === 0 && (
          <div className="panel-soft px-6 py-12 text-center">
            <Compass className="mx-auto size-7 text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">
              No roadmaps yet. Tell Remi what you want to learn.
            </p>
            <Button asChild className="press mt-5 rounded-2xl">
              <Link to="/conversation">Plan something with Remi</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function RoadmapCard({ roadmap, onDelete }: { roadmap: Roadmap; onDelete: () => void }) {
  const { data: items = [] } = useQuery({
    queryKey: ["roadmap-items", roadmap.id],
    queryFn: () => fetchRoadmapItems(roadmap.id),
  });

  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const phases = new Set(items.map((i) => i.phase)).size;
  const topics = items.filter((i) => !i.parent_id).length;
  const subtopics = items.length - topics;

  return (
    <article className="card-soft p-6">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold">{roadmap.topic}</h2>
          {roadmap.summary && (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{roadmap.summary}</p>
          )}
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Layers className="size-3.5" />
            {phases} phases · {topics} topics · {subtopics} sub-topics
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete roadmap"
          onClick={onDelete}
          className="rounded-xl text-muted-foreground"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Progress value={pct} className="h-2.5 rounded-full" />
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {done}/{items.length}
        </span>
      </div>

      <Button asChild className="press mt-5 gap-1.5 rounded-2xl">
        <Link to="/roadmap/$roadmapId" params={{ roadmapId: roadmap.id }}>
          Open roadmap <ChevronRight className="size-4" />
        </Link>
      </Button>
    </article>
  );
}
