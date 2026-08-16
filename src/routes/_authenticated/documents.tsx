import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Download,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Link2,
  Loader2,
  Play,
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
  type StudyResource,
} from "@/lib/study";
import { isSubscriptionPremium } from "@/lib/limits";
import { saveExtractedTextFn, triggerDocumentExtractionFn } from "@/lib/study.functions";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({
    meta: [
      { title: "Documents — Remispace" },
      {
        name: "description",
        content:
          "Browse, search and manage every document, image and file you've attached to Remi chat.",
      },
      { property: "og:title", content: "Documents — Remispace" },
      {
        property: "og:description",
        content: "Your full document library — PDFs, images, notes and links in one place.",
      },
    ],
  }),
  component: DocumentsPage,
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
  "chat-upload": "Chat upload",
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
  { value: "image", label: "Images" },
  { value: "note", label: "Notes" },
  { value: "video", label: "Videos" },
  { value: "link", label: "Links" },
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

/* ---------- main page ---------- */

function DocumentsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<StudyResource | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runTriggerExtraction = useServerFn(triggerDocumentExtractionFn);
  const runSaveText = useServerFn(saveExtractedTextFn);

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["study-resources"],
    queryFn: () => fetchStudyResources(),
  });

  const filtered = useMemo(() => {
    let list = resources;
    if (kindFilter !== "all") {
      list = list.filter((r) => r.kind === kindFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.title.toLowerCase().includes(q));
    }
    return list;
  }, [resources, kindFilter, search]);

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
      });

      refreshResources();
      toast.success("Document added — processing text & chunks...");

      // 1. Immediately trigger server-side extraction, chunking & embedding
      const extRes = await runTriggerExtraction({
        data: { resourceId: created.id, storagePath: path },
      });
      refreshResources();

      if (extRes.success && (extRes.textLength ?? 0) > 0) {
        toast.success(`Text extracted successfully (${extRes.textLength} characters ready)!`);
      } else {
        toast.success("Document added to workspace!");
      }

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
      const msg = err instanceof Error ? err.message : "Upload failed";
      if (msg.includes("15MB") || msg.includes("limit") || msg.includes("upgrade") || msg.includes("exceeds")) {
        toast.error(msg, {
          action: {
            label: "Upgrade",
            onClick: () => {
              window.location.href = "/pricing";
            },
          },
          duration: 10000,
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setUploading(false);
    }
  };

  const removeResource = useMutation({
    mutationFn: (resource: StudyResource) => deleteStudyResource(resource),
    onSuccess: () => {
      toast.success("Document deleted");
      refreshResources();
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,.doc,.docx,.png,.jpg,.jpeg,.json,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUpload(file);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Documents</h1>
          <p className="mt-2 text-muted-foreground">
            Every file you've attached to Remi, in one place.
          </p>
        </div>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="rounded-full gap-2 shadow-sm"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Upload Document
        </Button>
      </div>

      {/* Filters */}
      <div className="card-soft mt-6 flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="rounded-2xl pl-9"
          />
        </div>
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-40 rounded-2xl" aria-label="Filter by type">
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
          <Loader2 className="size-5 animate-spin" /> Loading documents…
        </div>
      ) : filtered.length > 0 ? (
        <div className="mt-6 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((resource) => (
            <DocumentCard
              key={resource.id}
              resource={resource}
              onDelete={() => setDeleteTarget(resource)}
            />
          ))}
        </div>
      ) : resources.length > 0 ? (
        /* Filters produced no results */
        <div className="mt-12 rounded-3xl bg-muted/50 px-6 py-14 text-center">
          <Search className="mx-auto size-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            No documents match your search or filter.
          </p>
        </div>
      ) : (
        /* True empty state */
        <div className="mt-12 rounded-3xl bg-muted/50 px-6 py-14 text-center">
          <FolderOpen className="mx-auto size-12 text-muted-foreground/40" />
          <h2 className="mt-4 font-display text-lg font-bold">No documents yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Attach a file to Remi — it'll appear in this library automatically.
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
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.title}&rdquo; will be permanently removed from your library and
              storage. This can&apos;t be undone.
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

/* ---------- document card ---------- */

function DocumentCard({ resource, onDelete }: { resource: StudyResource; onDelete: () => void }) {
  const kind = resource.kind ?? "note";
  const Icon = KIND_ICONS[kind] ?? FileText;
  const colorClass = KIND_COLORS[kind] ?? "bg-muted text-muted-foreground";
  const label = KIND_LABELS[kind] ?? kind;
  const isImage = kind === "image" && resource.storage_path;

  return (
    <article className="card-soft group relative flex flex-col overflow-hidden">
      {/* Preview area */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-2xl bg-muted/30">
        {isImage && resource.storage_path ? (
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
            className="press h-9 gap-1.5 rounded-2xl bg-white/90 text-neutral-900 shadow-md hover:bg-white"
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
            aria-label="Delete document"
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
        <div className="mt-auto flex items-center gap-1.5">
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
