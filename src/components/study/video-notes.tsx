import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  Pen,
  Play,
  Plus,
  Search,
  Sparkle,
  Trash2,
  Wand2,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createVideoNote, deleteVideoNote, fetchVideoNotes } from "@/lib/study";
import { autoNoteFromTranscript, getTranscriptFromUrl } from "@/lib/study.functions";
import {
  extractYouTubeId,
  formatVideoTimestamp,
  getYouTubeEmbedUrl,
  getYouTubeWatchUrl,
} from "@/lib/youtube";

interface YTPlayer {
  getCurrentTime(): number;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    element: HTMLElement | string,
    options: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, unknown>;
      events?: {
        onReady?: (event: unknown) => void;
        onError?: (event: unknown) => void;
      };
    },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiLoadingPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();

  if (!ytApiLoadingPromise) {
    ytApiLoadingPromise = new Promise<void>((resolve) => {
      // Check if script is already in DOM
      const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
      if (!existingScript) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        tag.async = true;
        document.head.appendChild(tag);
      }

      const prevHandler = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevHandler) prevHandler();
        resolve();
      };

      // Safety timeout: resolve anyway after 3.5s so fallback iframe can activate
      setTimeout(() => resolve(), 3500);
    });
  }

  return ytApiLoadingPromise;
}

type TabMode = "notes" | "transcript";
type NoteMode = "manual" | "auto";

/**
 * A resilient YouTube study player with synchronized timestamped notes,
 * auto-note generation from transcripts, and an interactive transcript browser.
 */
export function VideoNotes({
  resourceId,
  videoId: rawVideoId,
  title,
}: {
  resourceId: string;
  videoId: string;
  title: string;
}) {
  const videoId = extractYouTubeId(rawVideoId) ?? rawVideoId;
  const elementId = useId().replace(/:/g, "_");
  const qc = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [playerReady, setPlayerReady] = useState(false);
  const [useFallbackIframe, setUseFallbackIframe] = useState(false);
  const [activeTab, setActiveTab] = useState<TabMode>("notes");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<NoteMode>("manual");
  const [autoLoading, setAutoLoading] = useState(false);
  const [transcriptSearch, setTranscriptSearch] = useState("");

  const runAutoNote = useServerFn(autoNoteFromTranscript);
  const runGetTranscript = useServerFn(getTranscriptFromUrl);

  const { data: notes = [] } = useQuery({
    queryKey: ["video-notes", resourceId],
    queryFn: () => fetchVideoNotes(resourceId),
  });

  // Query video transcript
  const { data: transcriptData, isLoading: transcriptLoading } = useQuery({
    queryKey: ["video-transcript", videoId],
    queryFn: async () => {
      const res = await runGetTranscript({ data: { urlOrId: videoId } });
      return res.success ? res : null;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const refreshNotes = () => void qc.invalidateQueries({ queryKey: ["video-notes", resourceId] });

  // Initialize YouTube Player with fallback mechanism
  useEffect(() => {
    let alive = true;
    let playerInstance: YTPlayer | null = null;

    setPlayerReady(false);
    setUseFallbackIframe(false);

    // Timeout fallback if YT JS API fails to mount
    const timeoutId = setTimeout(() => {
      if (alive && !playerRef.current) {
        setUseFallbackIframe(true);
      }
    }, 3000);

    void loadYouTubeApi().then(() => {
      if (!alive || !containerRef.current) return;

      if (!window.YT?.Player) {
        setUseFallbackIframe(true);
        return;
      }

      try {
        playerInstance = new window.YT.Player(containerRef.current, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            rel: 0,
            modestbranding: 1,
            enablejsapi: 1,
            origin: typeof window !== "undefined" ? window.location.origin : undefined,
          },
          events: {
            onReady: () => {
              if (alive) {
                clearTimeout(timeoutId);
                playerRef.current = playerInstance;
                setPlayerReady(true);
              }
            },
            onError: () => {
              if (alive) {
                setUseFallbackIframe(true);
              }
            },
          },
        });
      } catch {
        if (alive) setUseFallbackIframe(true);
      }
    });

    return () => {
      alive = false;
      clearTimeout(timeoutId);
      if (playerInstance?.destroy) {
        try {
          playerInstance.destroy();
        } catch {
          // Ignore
        }
      }
      playerRef.current = null;
      setPlayerReady(false);
    };
  }, [videoId]);

  const getCurrentSeconds = useCallback((): number => {
    if (playerRef.current?.getCurrentTime) {
      try {
        return Math.round(playerRef.current.getCurrentTime());
      } catch {
        return 0;
      }
    }
    return 0;
  }, []);

  const seekTo = useCallback(
    (seconds: number) => {
      if (playerRef.current?.seekTo) {
        try {
          playerRef.current.seekTo(seconds, true);
          return;
        } catch {
          // Continue to iframe fallback
        }
      }
      // If fallback iframe is in use, update its src with start param
      if (iframeRef.current) {
        iframeRef.current.src = getYouTubeEmbedUrl(videoId, { autoplay: true, start: seconds });
      }
    },
    [videoId],
  );

  const addNote = useMutation({
    mutationFn: () =>
      createVideoNote({
        resource_id: resourceId,
        seconds: getCurrentSeconds(),
        note: note.trim(),
      }),
    onSuccess: () => {
      setNote("");
      refreshNotes();
      toast.success("Note saved!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeNote = useMutation({
    mutationFn: deleteVideoNote,
    onSuccess: refreshNotes,
  });

  const handleAutoNote = async () => {
    const seconds = getCurrentSeconds();
    setAutoLoading(true);
    try {
      const result = await runAutoNote({ data: { videoId, resourceId, seconds } });
      if (result.success && result.note) {
        setNote(result.note);
        toast.success("Note generated from transcript at timestamp!");
      } else {
        toast.error(result.error ?? "No transcript available at this timestamp");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to get transcript");
    } finally {
      setAutoLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (note.trim()) addNote.mutate();
  };

  const filteredSegments = (transcriptData?.segments ?? []).filter((s) =>
    transcriptSearch.trim()
      ? s.text.toLowerCase().includes(transcriptSearch.toLowerCase())
      : true,
  );

  return (
    <div className="space-y-5">
      {/* YouTube Player Container */}
      <div className="overflow-hidden rounded-3xl border border-border bg-black shadow-soft">
        <div className="aspect-video w-full relative">
          {useFallbackIframe ? (
            <iframe
              ref={iframeRef}
              src={getYouTubeEmbedUrl(videoId)}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="size-full border-0"
            />
          ) : (
            <div id={`yt-player-${elementId}`} ref={containerRef} className="size-full" />
          )}
        </div>
      </div>

      {/* Action header with Open on YouTube and status */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-4 text-primary" />
          <span>
            {playerReady
              ? "Live sync enabled — notes capture playback timestamp"
              : "Video ready"}
          </span>
        </div>
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 rounded-xl text-xs">
          <a href={getYouTubeWatchUrl(videoId)} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" /> Watch on YouTube
          </a>
        </Button>
      </div>

      {/* Tabs Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("notes")}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
              activeTab === "notes"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <Pen className="size-3.5" /> Timestamped Notes ({notes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("transcript")}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
              activeTab === "transcript"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <FileText className="size-3.5" /> Full Transcript
          </button>
        </div>
      </div>

      {/* Tab 1: Notes & Annotation */}
      {activeTab === "notes" && (
        <div className="space-y-4">
          {/* Note Mode Switcher */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("manual")}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-semibold transition-colors ${
                mode === "manual"
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Pen className="size-3" /> Manual Note
            </button>
            <button
              type="button"
              onClick={() => setMode("auto")}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-semibold transition-colors ${
                mode === "auto"
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Wand2 className="size-3" /> Auto (from transcript)
            </button>
          </div>

          {/* Note Form */}
          <form className="card-soft flex flex-col gap-3 p-5" onSubmit={handleSubmit}>
            {mode === "auto" && (
              <Button
                type="button"
                variant="outline"
                className="press gap-2 self-start rounded-2xl text-sm font-medium"
                onClick={() => void handleAutoNote()}
                disabled={autoLoading}
              >
                {autoLoading ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <Sparkle className="size-4 text-primary" />
                )}
                {autoLoading ? "Extracting from transcript…" : "Generate note at current timestamp"}
              </Button>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  mode === "auto"
                    ? "Auto-generated note will appear here (edit before saving)…"
                    : "Type your note at the current video timestamp…"
                }
                className="min-w-40 flex-1 rounded-2xl h-11 text-base"
              />
              <Button
                type="submit"
                className="press gap-2 rounded-2xl h-11 px-5 text-base font-semibold"
                disabled={!note.trim() || addNote.isPending}
              >
                <Plus className="size-5" /> Pin note
              </Button>
            </div>
          </form>

          {/* Notes List */}
          <ul className="space-y-3">
            {notes.map((n) => (
              <li
                key={n.id}
                className="flex items-start gap-3 rounded-2xl border border-border px-4 py-3.5 bg-card shadow-soft hover:shadow-lift transition-all"
              >
                <button
                  type="button"
                  onClick={() => seekTo(n.seconds)}
                  className="press flex items-center gap-1.5 rounded-xl bg-primary/10 px-2.5 py-1.5 text-sm font-bold tabular-nums text-primary transition-colors hover:bg-primary/20"
                  title="Click to jump video to this moment"
                >
                  <Play className="size-3 fill-current" />
                  {formatVideoTimestamp(n.seconds)}
                </button>
                <p className="min-w-0 flex-1 text-base leading-relaxed text-foreground">{n.note}</p>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete note"
                  onClick={() => removeNote.mutate(n.id)}
                  className="rounded-xl text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
            {notes.length === 0 && (
              <li className="rounded-2xl bg-muted/50 px-5 py-8 text-center text-base text-muted-foreground">
                <BookOpen className="mx-auto mb-2 size-6 text-primary" />
                No timestamped notes pinned yet. Capture your first takeaway while watching!
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Tab 2: Full Transcript Browser */}
      {activeTab === "transcript" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
                placeholder="Search keywords inside transcript…"
                className="pl-9 rounded-2xl h-10 text-sm"
              />
            </div>
            {transcriptSearch && (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl text-xs text-muted-foreground"
                onClick={() => setTranscriptSearch("")}
              >
                Clear
              </Button>
            )}
          </div>

          {transcriptLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
              <Loader2 className="size-4 animate-spin text-primary" /> Loading video transcript…
            </div>
          ) : filteredSegments.length > 0 ? (
            <div className="max-h-[450px] overflow-y-auto space-y-2 rounded-2xl border border-border bg-card p-4">
              {filteredSegments.map((s, idx) => (
                <div
                  key={`${s.offset}-${idx}`}
                  className="group flex items-start gap-3 rounded-xl p-2.5 hover:bg-muted/60 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => seekTo(s.offset)}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold tabular-nums text-primary group-hover:bg-primary/20 transition-colors"
                    title="Jump video to this moment"
                  >
                    <Play className="size-2.5 fill-current" />
                    {formatVideoTimestamp(s.offset)}
                  </button>
                  <p className="flex-1 text-sm leading-relaxed text-foreground">{s.text}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setNote(s.text);
                      setActiveTab("notes");
                      toast.info("Transcript quote loaded into note creator");
                    }}
                    className="opacity-0 group-hover:opacity-100 rounded-lg p-1 text-xs font-semibold text-muted-foreground hover:text-primary transition-opacity"
                    title="Add quote to notes"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-muted/40 p-8 text-center text-sm text-muted-foreground">
              {transcriptSearch
                ? `No transcript lines found matching "${transcriptSearch}".`
                : "No subtitles or transcript available for this video."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
