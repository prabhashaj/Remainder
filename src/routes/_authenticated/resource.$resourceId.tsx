import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fetchRoadmapResource } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/resource/$resourceId")({
  head: () => ({
    meta: [
      { title: "Resource — Remispace" },
      {
        name: "description",
        content: "Watch or read a learning resource without leaving Remispace.",
      },
      { property: "og:title", content: "Resource — Remispace" },
      {
        property: "og:description",
        content: "Learn inside Remispace — no redirects.",
      },
    ],
  }),
  component: ResourceViewer,
});

function extractYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/,
  );
  return m ? (m[1] ?? null) : null;
}

function ResourceViewer() {
  const { resourceId } = Route.useParams();
  const { data: resource, isLoading } = useQuery({
    queryKey: ["roadmap-resource", resourceId],
    queryFn: () => fetchRoadmapResource(resourceId),
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <p className="text-muted-foreground">This resource could not be found.</p>
        <Button asChild className="press mt-4 rounded-2xl">
          <Link to="/roadmaps">Back to roadmaps</Link>
        </Button>
      </div>
    );
  }

  const youtubeId = extractYouTubeId(resource.url);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <Button asChild variant="ghost" size="sm" className="rounded-xl text-muted-foreground">
        <Link to="/roadmaps">
          <ArrowLeft className="size-4" /> Back to roadmaps
        </Link>
      </Button>

      <div className="mt-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold">{resource.title}</h1>
          <span className="mt-1 inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize text-muted-foreground">
            {resource.kind}
          </span>
        </div>
        <a href={resource.url} target="_blank" rel="noreferrer">
          <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground">
            <ExternalLink className="size-4" /> Open
          </Button>
        </a>
      </div>

      {youtubeId ? (
        <div className="mt-6 aspect-video overflow-hidden rounded-3xl border border-border">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title={resource.title}
            className="size-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="mt-6 card-soft overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
            <span className="truncate text-xs font-medium text-muted-foreground">
              {resource.url}
            </span>
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-xs">
              <a href={resource.url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" /> Open in new tab
              </a>
            </Button>
          </div>
          <iframe
            src={resource.url}
            title={resource.title}
            className="h-[600px] w-full border-0 bg-background"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        </div>
      )}

      <div className="mt-6">
        <Button asChild className="press rounded-2xl">
          <Link to="/focus" search={{ item: resource.roadmap_item_id ?? "" }}>
            <Timer className="size-4" /> Start a focus session
          </Link>
        </Button>
      </div>
    </div>
  );
}
