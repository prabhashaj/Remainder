import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  BookOpen,
  Download,
  FileText,
  Image as ImageIcon,
  Library as LibraryIcon,
  Link2,
  Loader2,
  Play,
  Plus,
  Search,
  StickyNote,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createStudyResource,
  deleteStudyResource,
  fetchStudyResources,
  signedMaterialUrl,
  uploadMaterial,
  youtubeId,
  type StudyResource,
} from "@/lib/study";
import { isSubscriptionPremium } from "@/lib/limits";
import {
  saveExtractedTextFn,
  triggerDocumentExtractionFn,
  getYouTubeMetadataFn,
  fetchTranscript,
} from "@/lib/study.functions";
import { extractYouTubeId, getYouTubeThumbnailUrl } from "@/lib/youtube";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Resource Library — Remispace" },
      {
        name: "description",
        content: "PDFs, videos and links for every subject in your Resource Library.",
      },
      { property: "og:title", content: "Resource Library — Remispace" },
      {
        property: "og:description",
        content: "PDFs, videos and links for every subject.",
      },
    ],
  }),
  component: LibraryPage,
});

/* ---------- kind helpers ---------- */

const KIND_LABELS: Record<string, string> = {
  pdf: "PDF",
  image: "Image",
  note: "Note",
  video: "Video",
  link: "Link",
  article: "Article",
  course: "Course",
  interactive: "Interactive",
  "chat-upload": "Upload",
};

const KIND_ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  image: ImageIcon,
  note: StickyNote,
  video: Play,
  link: Link2,
  article: Link2,
  course: Link2,
  interactive: Link2,
  "chat-upload": FileText,
};

const KIND_COLORS: Record<string, string> = {
  pdf: "bg-rose-500/10 text-rose-600",
  image: "bg-violet-500/10 text-violet-600",
  note: "bg-amber-500/10 text-amber-600",
  video: "bg-sky-500/10 text-sky-600",
  link: "bg-emerald-500/10 text-emerald-600",
  article: "bg-emerald-500/10 text-emerald-600",
  course: "bg-indigo-500/10 text-indigo-600",
  interactive: "bg-teal-500/10 text-teal-600",
  "chat-upload": "bg-slate-500/10 text-slate-600",
};

const FILTER_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "pdf", label: "PDFs" },
  { value: "video", label: "Videos" },
  { value: "link", label: "Links & Articles" },
  { value: "note", label: "Notes" },
  { value: "image", label: "Images" },
];

function relativeDate(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/* ---------- image thumbnail ---------- */

function ImageThumbnail({ storagePath }: { storagePath: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void signedMaterialUrl(storagePath).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [storagePath]);

  if (!url) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/40">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />;
}

/* ---------- main library page ---------- */

function LibraryPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<StudyResource | null>(null);
  const [uploading, setUploading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const runTriggerExtraction = useServerFn(triggerDocumentExtractionFn);
  const runSaveText = useServerFn(saveExtractedTextFn);
  const runGetMetadata = useServerFn(getYouTubeMetadataFn);
  const runFetchTranscript = useServerFn(fetchTranscript);

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["study-resources"],
    queryFn: () => fetchStudyResources(),
  });

  const refreshResources = () => void qc.invalidateQueries({ queryKey: ["study-resources"] });

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

  const handleUpload = async (file: File) => {
    const maxMb = isPremium ? 50 : 15;
    const maxBytes = maxMb * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(
        isPremium
          ? `File exceeds the maximum limit of ${maxMb}MB.`
          : `File exceeds the 15MB Free tier limit. Please upgrade to Pro to upload documents up to 50MB.`,
      );
      return;
    }

    setUploading(true);
    try {
      const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
      const isImage = file.type.startsWith("image/");
      const path = await uploadMaterial(file);
      const created = await createStudyResource({
        title: file.name.replace(/\.[^/.]+$/, ""),
        kind: isPdf ? "pdf" : isImage ? "image" : "note",
        storage_path: path,
        mime_type: file.type || "application/octet-stream",
      });

      refreshResources();
      toast.success("Document added to library");

      // 1. Immediately trigger server-side extraction, chunking & embedding
      void runTriggerExtraction({ data: { resourceId: created.id, storagePath: path } }).then(
        () => {
          refreshResources();
        },
      );

      // 2. Client text extraction for plain text documents
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

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
      setLinkUrl("");
      setLinkTitle("");
      refreshResources();
      toast.success("Resource added to library");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeResource = useMutation({
    mutationFn: (r: StudyResource) => deleteStudyResource(r),
    onSuccess: () => {
      refreshResources();
      setDeleteTarget(null);
      toast.success("Resource removed from Library");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    let list = resources;
    if (kindFilter !== "all") {
      if (kindFilter === "link") {
        list = list.filter((r) => r.kind === "link" || r.kind === "article");
      } else {
        list = list.filter((r) => r.kind === kindFilter);
      }
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.title.toLowerCase().includes(q));
    }
    return list;
  }, [resources, kindFilter, search]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8 space-y-6 pb-28 sm:pb-12">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold">Resource library</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          PDFs, videos and links for every subject.
        </p>
      </div>

      {/* Input Action Bar */}
      <div className="card-soft flex flex-wrap items-center gap-2.5 p-3 sm:p-4 rounded-3xl">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.txt,.md,.doc,.docx,.csv,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
            e.target.value = "";
          }}
        />
        <Button
          variant="secondary"
          className="press gap-1.5 rounded-2xl h-11 px-4 text-sm font-semibold shrink-0"
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
          className="w-full sm:w-44 rounded-2xl h-11 text-sm"
        />
        <Input
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="Paste a video or article link…"
          className="min-w-48 flex-1 rounded-2xl h-11 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && linkUrl.trim()) {
              e.preventDefault();
              addLink.mutate();
            }
          }}
        />
        <Button
          className="press gap-1.5 rounded-2xl h-11 px-5 font-bold shadow-soft shrink-0"
          onClick={() => linkUrl.trim() && addLink.mutate()}
          disabled={addLink.isPending || !linkUrl.trim()}
        >
          <Plus className="size-4" /> Add
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search resources in library…"
            className="rounded-2xl pl-10 h-10 text-sm bg-card/60"
          />
        </div>
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-40 rounded-2xl h-10 text-sm bg-card/60" aria-label="Filter by type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl">
            {FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="mt-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> Loading resource library…
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              onDelete={() => setDeleteTarget(resource)}
            />
          ))}
        </div>
      ) : resources.length > 0 ? (
        <div className="rounded-3xl bg-muted/40 px-6 py-14 text-center">
          <Search className="mx-auto size-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            No resources match your search or filter.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl bg-muted/40 px-6 py-14 text-center">
          <LibraryIcon className="mx-auto size-12 text-muted-foreground/40" />
          <h2 className="mt-4 font-display text-lg font-bold">No resources in your library yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Upload a PDF or paste a link above to start collecting study materials for every subject.
          </p>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete resource?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.title}&rdquo; will be permanently removed from your library.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) removeResource.mutate(deleteTarget);
              }}
              disabled={removeResource.isPending}
            >
              {removeResource.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------- resource card ---------- */

function ResourceCard({ resource, onDelete }: { resource: StudyResource; onDelete: () => void }) {
  const kind = resource.kind ?? "note";
  const video = resource.url ? extractYouTubeId(resource.url) : null;
  const Icon = video ? Play : KIND_ICONS[kind] ?? FileText;
  const colorClass = KIND_COLORS[kind] ?? "bg-muted text-muted-foreground";
  const label = KIND_LABELS[kind] ?? kind;
  const isImage = kind === "image" && resource.storage_path;

  return (
    <article className="card-soft group relative flex flex-col overflow-hidden transition-all hover:shadow-lift">
      {/* Preview area */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-2xl bg-muted/30">
        {video ? (
          <div className="relative size-full bg-black">
            <img
              src={getYouTubeThumbnailUrl(video, "hq")}
              alt={resource.title}
              className="size-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/25 flex items-center justify-center transition-all group-hover:bg-black/40">
              <div className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-110">
                <Play className="size-5 fill-current ml-0.5" />
              </div>
            </div>
          </div>
        ) : isImage && resource.storage_path ? (
          <ImageThumbnail storagePath={resource.storage_path} />
        ) : (
          <div
            className={`flex h-full items-center justify-center ${colorClass.replace("text-", "bg-").split(" ")[0]}/20`}
          >
            <Icon className={`size-10 ${colorClass.split(" ")[1]}`} />
          </div>
        )}

        {/* Hover overlay with actions */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/40 group-hover:opacity-100">
          <Button
            asChild
            size="sm"
            className="press h-9 gap-1.5 rounded-2xl bg-white/90 text-neutral-900 shadow-md hover:bg-white font-bold"
          >
            <Link to="/material/$resourceId" params={{ resourceId: resource.id }}>
              Open
            </Link>
          </Button>
          {resource.storage_path && (
            <DownloadButton storagePath={resource.storage_path} title={resource.title} />
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete resource"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDelete();
            }}
            className="size-9 rounded-xl bg-white/90 text-destructive shadow-md hover:bg-white"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <h3 className="truncate text-sm font-semibold leading-snug">{resource.title}</h3>
        <div className="mt-auto flex items-center justify-between gap-1.5 pt-1">
          <Badge variant="secondary" className="rounded-lg px-1.5 py-0 text-[10px] capitalize">
            {label}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {relativeDate(resource.created_at)}
          </span>
        </div>
      </div>
    </article>
  );
}

/* ---------- download button ---------- */

function DownloadButton({ storagePath, title }: { storagePath: string; title: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const url = await signedMaterialUrl(storagePath);
      const a = document.createElement("a");
      a.href = url;
      a.download = title;
      a.target = "_blank";
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error("Download failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Download"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        void handleDownload();
      }}
      disabled={loading}
      className="size-9 rounded-xl bg-white/90 text-neutral-900 shadow-md hover:bg-white"
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
    </Button>
  );
}
