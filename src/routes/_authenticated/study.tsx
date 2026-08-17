import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isSubscriptionPremium } from "@/lib/limits";
import {
  BookOpen,
  CheckCircle2,
  FileText,
  Link2,
  Loader2,
  Play,
  Plus,
  Timer,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useFocusTimer } from "@/components/focus-timer";
import { RoadmapInline } from "@/components/study/roadmap-inline";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { fetchRoadmapItems, fetchRoadmaps, fetchTasks, today, updateTask } from "@/lib/db";
import {
  createStudyResource,
  deleteStudyResource,
  fetchStudyResources,
  uploadMaterial,
  type StudyResource,
} from "@/lib/study";
import {
  saveExtractedTextFn,
  triggerDocumentExtractionFn,
  getYouTubeMetadataFn,
  fetchTranscript,
} from "@/lib/study.functions";
import { extractYouTubeId } from "@/lib/youtube";

export const Route = createFileRoute("/_authenticated/study")({
  head: () => ({
    meta: [
      { title: "Study Place — Remispace" },
      {
        name: "description",
        content:
          "One distraction-free view with your current lesson, today's study tasks, a focus timer and every resource for the subject.",
      },
      { property: "og:title", content: "Study Place — Remispace" },
      {
        property: "og:description",
        content: "Lesson, tasks, timer and your whole resource library in one calm place.",
      },
    ],
  }),
  component: StudyPlacePage,
});

const KINDS = ["pdf", "video", "article", "note"] as const;

function StudyPlacePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { start: startTimer, state: timer } = useFocusTimer();
  const fileRef = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState<string>("all");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) return null;
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      return sub;
    },
  });

  const isPremium = isSubscriptionPremium(subscription);

  const { data: roadmaps = [] } = useQuery({
    queryKey: ["roadmaps"],
    queryFn: fetchRoadmaps,
  });
  const { data: items = [] } = useQuery({
    queryKey: ["roadmap-items"],
    queryFn: () => fetchRoadmapItems(),
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
  });
  const { data: resources = [] } = useQuery({
    queryKey: ["study-resources"],
    queryFn: () => fetchStudyResources(),
  });

  const roadmapId = subject === "all" ? null : subject;

  const subjectItems = useMemo(
    () => items.filter((i) => (!roadmapId || i.roadmap_id === roadmapId) && i.parent_id),
    [items, roadmapId],
  );
  const nextLesson = subjectItems.find((i) => !i.done) ?? null;
  const learned = subjectItems.filter((i) => i.done).length;
  const pct = subjectItems.length ? Math.round((learned / subjectItems.length) * 100) : 0;

  const day = today();
  const openTasks = tasks.filter((t) => !t.done && (!t.due_date || t.due_date <= day)).slice(0, 6);

  const visibleResources = resources.filter((r) => !roadmapId || r.roadmap_id === roadmapId);

  // Roadmaps for inline viewer (filtered by subject)
  const visibleRoadmaps = roadmapId ? roadmaps.filter((r) => r.id === roadmapId) : roadmaps;

  const refreshResources = () => void qc.invalidateQueries({ queryKey: ["study-resources"] });

  const removeResource = useMutation({
    mutationFn: (resource: StudyResource) => deleteStudyResource(resource),
    onSuccess: refreshResources,
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleTask = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      updateTask(id, { done, status: done ? "done" : "todo" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const runTriggerExtraction = useServerFn(triggerDocumentExtractionFn);
  const runSaveText = useServerFn(saveExtractedTextFn);
  const runGetMetadata = useServerFn(getYouTubeMetadataFn);
  const runFetchTranscript = useServerFn(fetchTranscript);

  const addLink = useMutation({
    mutationFn: async () => {
      const trimmed = linkUrl.trim();
      if (!trimmed) return;
      const ytId = extractYouTubeId(trimmed);
      const isVid = Boolean(ytId);
      const kind = isVid ? "video" : "article";

      let finalTitle = linkTitle.trim();
      if (!finalTitle && ytId) {
        try {
          const metaRes = await runGetMetadata({ data: { urlOrId: ytId } });
          if (metaRes.success && metaRes.metadata?.title) {
            finalTitle = metaRes.metadata.title;
          }
        } catch {
          // Ignore
        }
      }

      if (!finalTitle) {
        finalTitle = isVid
          ? "YouTube Video"
          : (() => {
              try {
                return new URL(trimmed).hostname.replace(/^www\./, "");
              } catch {
                return "Article";
              }
            })();
      }

      const created = await createStudyResource({
        title: finalTitle,
        kind,
        url: trimmed,
        roadmap_id: roadmapId,
      });

      if (isVid && ytId && created?.id) {
        // Trigger transcript extraction & embedding in background
        void runFetchTranscript({ data: { videoId: ytId, resourceId: created.id } }).then(() => {
          refreshResources();
        });
      }

      return created;
    },
    onSuccess: () => {
      setLinkTitle("");
      setLinkUrl("");
      refreshResources();
      toast.success("Resource added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleUpload = async (file: File) => {
    const maxBytes = (isPremium ? 50 : 15) * 1024 * 1024;
    if (file.size > maxBytes) {
      if (!isPremium) {
        toast.error(
          `"${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the 15MB Free limit. Upgrade to Pro to upload documents up to 50MB.`,
          {
            action: {
              label: "Upgrade",
              onClick: () => {
                navigate({ to: "/pricing" });
              },
            },
            duration: 10000,
          },
        );
      } else {
        toast.error(`"${file.name}" exceeds the 50MB maximum upload limit.`);
      }
      return;
    }

    setUploading(true);
    try {
      const path = await uploadMaterial(file);
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const kind = isPdf ? "pdf" : file.type.startsWith("image/") ? "image" : "note";

      const created = await createStudyResource({
        title: file.name.replace(/\.[^.]+$/, ""),
        kind,
        storage_path: path,
        mime_type: file.type || "application/octet-stream",
        roadmap_id: roadmapId,
      });

      refreshResources();
      toast.success("Document added — processing text & chunks...");

      // 1. Immediately trigger server-side extraction, chunking & embedding
      void runTriggerExtraction({ data: { resourceId: created.id, storagePath: path } }).then(
        () => {
          refreshResources();
        },
      );

      // 2. If client can read plain text immediately (e.g. .txt, .md, .json, .csv)
      if (
        !isPdf &&
        (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md"))
      ) {
        const text = await file.text();
        if (text && text.trim()) {
          void runSaveText({ data: { resourceId: created.id, text } }).then(() => {
            refreshResources();
          });
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Study Place</h1>
          <p className="mt-2 text-muted-foreground">
            Everything for this session — and nothing else.
          </p>
        </div>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="w-56 rounded-2xl" aria-label="Subject">
            <SelectValue placeholder="All subjects" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl">
            <SelectItem value="all">All subjects</SelectItem>
            {roadmaps.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.topic}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-3">
        <section className="card-soft p-6 lg:col-span-2">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-primary">
            Up next
          </h2>
          {nextLesson ? (
            <>
              <p className="mt-2 text-xs font-medium text-muted-foreground">{nextLesson.phase}</p>
              <h3 className="mt-1 font-display text-xl font-bold">{nextLesson.title}</h3>
              {nextLesson.detail && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {nextLesson.detail}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild className="press gap-1.5 rounded-2xl">
                  <Link to="/lesson/$itemId" params={{ itemId: nextLesson.id }}>
                    <BookOpen className="size-4" /> Open lesson
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="press gap-1.5 rounded-2xl"
                  onClick={() =>
                    startTimer(nextLesson.estimated_minutes || 25, nextLesson.title, nextLesson.id)
                  }
                >
                  <Timer className="size-4" /> Start focus
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing queued. Ask Remi for a roadmap and it will show up here.
            </p>
          )}

          <div className="mt-6">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Subject progress</span>
              <span className="tabular-nums">
                {learned}/{subjectItems.length} sub-topics
              </span>
            </div>
            <Progress value={pct} className="mt-2 h-2 rounded-full" />
          </div>
        </section>

        <section className="card-soft p-6">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-primary">
            Session
          </h2>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums">
            {timer
              ? `${String(Math.floor(timer.secondsLeft / 60)).padStart(2, "0")}:${String(
                  timer.secondsLeft % 60,
                ).padStart(2, "0")}`
              : "--:--"}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {timer ? timer.title : "No timer running"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[15, 25, 45].map((m) => (
              <Button
                key={m}
                variant="secondary"
                size="sm"
                className="press rounded-2xl"
                onClick={() => startTimer(m, nextLesson?.title ?? "Study session")}
              >
                {m}m
              </Button>
            ))}
          </div>

          <h3 className="mt-6 font-display text-sm font-bold uppercase tracking-wide text-primary">
            Today's tasks
          </h3>
          <ul className="mt-3 space-y-2">
            {openTasks.map((task) => (
              <li key={task.id} className="flex items-start gap-2.5">
                <Checkbox
                  checked={task.done}
                  onCheckedChange={(v) => toggleTask.mutate({ id: task.id, done: Boolean(v) })}
                  className="mt-0.5 rounded-md"
                />
                <span className="text-sm leading-snug">{task.title}</span>
              </li>
            ))}
            {openTasks.length === 0 && (
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4" /> All clear for today.
              </li>
            )}
          </ul>
        </section>
      </div>

      {/* Inline Roadmap Viewer */}
      {visibleRoadmaps.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold">Your roadmaps</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Expand to browse phases, topics and read lessons inline.
          </p>
          <div className="mt-4 space-y-3">
            {visibleRoadmaps.map((rm) => (
              <RoadmapInline key={rm.id} roadmap={rm} items={items} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold">Resource library</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          PDFs, videos and links for{" "}
          {roadmapId
            ? (roadmaps.find((r) => r.id === roadmapId)?.topic ?? "this subject")
            : "every subject"}
          .
        </p>

        <div className="card-soft mt-4 flex flex-wrap items-center gap-2 p-4">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
              e.target.value = "";
            }}
          />
          <Button
            variant="secondary"
            className="press gap-1.5 rounded-2xl"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Upload PDF
          </Button>
          <Input
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-44 rounded-2xl"
          />
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="Paste a video or article link…"
            className="min-w-48 flex-1 rounded-2xl"
          />
          <Button
            className="press gap-1.5 rounded-2xl"
            onClick={() => linkUrl.trim() && addLink.mutate()}
            disabled={addLink.isPending}
          >
            <Plus className="size-4" /> Add
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleResources.map((resource) => {
            const video = resource.url ? extractYouTubeId(resource.url) : null;
            const Icon = video ? Play : resource.storage_path ? FileText : Link2;
            return (
              <article key={resource.id} className="card-soft flex flex-col gap-3 p-4">
                <div className="flex items-start gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold">{resource.title}</h3>
                    <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                      {resource.kind}
                      {resource.summary ? " · brief ready" : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove resource"
                    onClick={() => removeResource.mutate(resource)}
                    className="rounded-xl text-muted-foreground"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <Button asChild variant="outline" size="sm" className="press rounded-2xl">
                  <Link to="/material/$resourceId" params={{ resourceId: resource.id }}>
                    Open & annotate
                  </Link>
                </Button>
              </article>
            );
          })}
          {visibleResources.length === 0 && (
            <p className="rounded-3xl bg-muted/50 px-5 py-10 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
              Add your first PDF or link and everything for this subject lives here.
            </p>
          )}
        </div>
      </section>

      <p className="mt-8 text-xs text-muted-foreground">Kinds supported: {KINDS.join(", ")}.</p>
    </div>
  );
}
