import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ClientOnly } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  FileText,
  Highlighter,
  Loader2,
  RefreshCw,
  Sparkle,
  Timer,
  Trash2,
} from "lucide-react";
import { Suspense, lazy, useEffect, useState } from "react";
import { toast } from "sonner";

import { MessageResponse } from "@/components/ai-elements/message";
import { useFocusTimer } from "@/components/focus-timer";
import { MaterialTutor } from "@/components/study/material-tutor";
import { VideoNotes } from "@/components/study/video-notes";
import { Button } from "@/components/ui/button";
import {
  createHighlight,
  deleteHighlight,
  fetchHighlights,
  fetchStudyResource,
  signedMaterialUrl,
  updateStudyResource,
  youtubeId,
} from "@/lib/study";
import {
  summarizeMaterial,
  generateNotebookFromTranscript,
} from "@/lib/study.functions";

const PdfReader = lazy(() => import("@/components/study/pdf-reader"));

export const Route = createFileRoute("/_authenticated/material/$resourceId")({
  head: () => ({
    meta: [
      { title: "Material — Remainder" },
      {
        name: "description",
        content:
          "Read, highlight and question your own study material without leaving Remainder.",
      },
      { property: "og:title", content: "Material — Remainder" },
      {
        property: "og:description",
        content: "Annotate documents and videos, then ask Remi about them.",
      },
    ],
  }),
  component: MaterialPage,
});

function MaterialPage() {
  const { resourceId } = Route.useParams();
  const qc = useQueryClient();
  const { start: startTimer } = useFocusTimer();
  const runSummary = useServerFn(summarizeMaterial);
  const runNotebook = useServerFn(generateNotebookFromTranscript);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const { data: resource, isLoading } = useQuery({
    queryKey: ["study-resource", resourceId],
    queryFn: () => fetchStudyResource(resourceId),
  });
  const { data: highlights = [] } = useQuery({
    queryKey: ["highlights", resourceId],
    queryFn: () => fetchHighlights(resourceId),
  });

  const storagePath = resource?.storage_path ?? null;
  const [urlError, setUrlError] = useState(false);

  useEffect(() => {
    if (!storagePath) return;
    let alive = true;
    setUrlError(false);
    void signedMaterialUrl(storagePath)
      .then((url) => {
        if (alive) setSignedUrl(url);
      })
      .catch((err) => {
        console.error("Failed to load material URL:", err);
        if (alive) setUrlError(true);
      });
    return () => {
      alive = false;
    };
  }, [storagePath]);

  const addHighlight = useMutation({
    mutationFn: ({ page, quote }: { page: number; quote: string }) =>
      createHighlight({ resource_id: resourceId, page, quote }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["highlights", resourceId] }),
  });
  const removeHighlight = useMutation({
    mutationFn: deleteHighlight,
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["highlights", resourceId] }),
  });
  const saveText = useMutation({
    mutationFn: ({ text, pages }: { text: string; pages: number }) =>
      updateStudyResource(resourceId, {
        extracted_text: text,
        page_count: pages,
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["study-resource", resourceId] }),
  });
  const summarize = useMutation({
    mutationFn: (force: boolean) =>
      runSummary({ data: { resourceId, force } }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["study-resource", resourceId] }),
  });

  const notebook = useMutation({
    mutationFn: () => {
      const vid = resource?.url ? youtubeId(resource.url) : null;
      if (!vid) throw new Error("Not a YouTube video");
      return runNotebook({
        data: { videoId: vid, resourceId, title: resource?.title ?? "Video" },
      });
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Notebook created!", {
          action: result.pageId
            ? {
                label: "Open notebook",
                onClick: () => {
                  window.location.href = `/page/${result.pageId}`;
                },
              }
            : undefined,
        });
        void qc.invalidateQueries({ queryKey: ["pages"] });
        void qc.invalidateQueries({ queryKey: ["study-resources"] });
      } else {
        toast.error(result.error ?? "Failed to generate notebook");
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-12 text-sm text-muted-foreground">
        Loading material…
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-12">
        <p className="text-sm text-muted-foreground">
          This material no longer exists.
        </p>
        <Button asChild className="press mt-4 rounded-2xl">
          <Link to="/study">Back to Study Place</Link>
        </Button>
      </div>
    );
  }

  const videoId = resource.url ? youtubeId(resource.url) : null;
  const isPdf = Boolean(resource.storage_path);
  const summaryError =
    summarize.data && !summarize.data.success ? summarize.data.error : null;

  return (
    <div className="mx-auto max-w-4xl px-5 pb-32 pt-8 sm:px-8">
      <Link
        to="/study"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to Study Place
      </Link>

      <div className="mt-4 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold">{resource.title}</h1>
          <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize text-muted-foreground">
            <FileText className="size-3" />
            {resource.kind}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="press gap-1.5 rounded-2xl"
          onClick={() => startTimer(25, resource.title)}
        >
          <Timer className="size-4" /> Focus
        </Button>
        {resource.url && (
          <Button asChild variant="ghost" size="sm" className="rounded-2xl">
            <a href={resource.url} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" /> Open source
            </a>
          </Button>
        )}
      </div>

      <section className="card-soft mt-6 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-bold uppercase tracking-wide text-primary">
            Before you commit
          </h2>
          <div className="flex items-center gap-2">
            {videoId && (
              <Button
                variant="outline"
                size="sm"
                className="press gap-1.5 rounded-2xl text-sm font-medium"
                onClick={() => notebook.mutate()}
                disabled={notebook.isPending}
              >
                {notebook.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <BookOpen className="size-4" />
                )}
                {notebook.isPending ? "Generating…" : "Generate notebook"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="press gap-1.5 rounded-2xl text-sm font-medium"
              onClick={() => summarize.mutate(Boolean(resource.summary))}
              disabled={summarize.isPending}
            >
              <RefreshCw
                className={`size-4 ${summarize.isPending ? "animate-spin" : ""}`}
              />
              {resource.summary ? "Refresh brief" : "Summarize"}
            </Button>
          </div>
        </div>
        {summarize.isPending ? (
          <p className="mt-4 flex items-center gap-2 text-base text-muted-foreground">
            <Sparkle className="size-5 animate-pulse text-primary" /> Reading it
            for you…
          </p>
        ) : resource.summary ? (
          <div className="mt-4 text-base leading-relaxed">
            <MessageResponse>{resource.summary}</MessageResponse>
          </div>
        ) : (
          <p className="mt-3 text-base text-muted-foreground">
            {summaryError ??
              "Get key points in seconds before reading or watching the whole thing."}
          </p>
        )}
      </section>

      {videoId ? (
        <section className="mt-8">
          <VideoNotes
            resourceId={resource.id}
            videoId={videoId}
            title={resource.title}
          />
        </section>
      ) : isPdf ? (
        <section className="mt-8">
          <ClientOnly
            fallback={
              <p className="py-12 text-center text-base text-muted-foreground">
                Preparing reader…
              </p>
            }
          >
            <Suspense
              fallback={
                <p className="py-12 text-center text-base text-muted-foreground">
                  Preparing reader…
                </p>
              }
            >
              {signedUrl ? (
                <PdfReader
                  fileUrl={signedUrl}
                  highlights={highlights}
                  onHighlight={(page, quote) =>
                    addHighlight.mutate({ page, quote })
                  }
                  onText={(text, pages) => {
                    if (!resource.extracted_text)
                      saveText.mutate({ text, pages });
                  }}
                />
              ) : urlError ? (
                <div className="card-soft p-8 text-center">
                  <p className="text-base text-muted-foreground">
                    Unable to load document preview. You can open or download it directly.
                  </p>
                  {resource.url && (
                    <Button asChild className="press mt-4 rounded-2xl text-base">
                      <a href={resource.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-4" /> Open Document
                      </a>
                    </Button>
                  )}
                </div>
              ) : (
                <p className="py-12 text-center text-base text-muted-foreground">
                  Preparing reader…
                </p>
              )}
            </Suspense>
          </ClientOnly>
        </section>
      ) : resource.url ? (
        <section className="mt-8 space-y-4">
          <div className="card-soft overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
              <span className="truncate text-sm font-medium text-muted-foreground">
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
              className="h-[550px] w-full border-0 bg-background"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          </div>
        </section>
      ) : null}

      {isPdf && (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 font-display text-base font-bold uppercase tracking-wide text-primary">
            <Highlighter className="size-5" /> Your highlights
          </h2>
          <ul className="mt-3 space-y-3">
            {highlights.map((h) => (
              <li
                key={h.id}
                className="flex items-start gap-3 rounded-2xl border border-border px-4 py-3.5 bg-amber-500/5 dark:bg-amber-500/10"
              >
                <span className="rounded-xl bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                  p.{h.page}
                </span>
                <p className="min-w-0 flex-1 text-base leading-relaxed text-foreground">
                  {h.quote}
                </p>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete highlight"
                  onClick={() => removeHighlight.mutate(h.id)}
                  className="rounded-xl text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
            {highlights.length === 0 && (
              <li className="rounded-2xl bg-muted/50 px-4 py-6 text-center text-base text-muted-foreground">
                Select any text in the document to turn it into a searchable
                light-yellow highlight note.
              </li>
            )}
          </ul>
        </section>
      )}

      <div className="mt-10">
        <MaterialTutor resourceId={resource.id} />
      </div>
    </div>
  );
}
