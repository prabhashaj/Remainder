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
  RotateCcw,
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
  getPlayerState(): number;
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
        onReady?: (event: { target: YTPlayer }) => void;
        onStateChange?: (event: { data: number; target: YTPlayer }) => void;
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
  const playerRef = useRef<YTPlayer | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const liveSecondsRef = useRef<number>(0);

  const [playerReady, setPlayerReady] = useState(false);
  const [liveSeconds, setLiveSeconds] = useState<number>(0);
  const [targetTimestamp, setTargetTimestamp] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<TabMode>("notes");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<NoteMode>("auto");
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

  // Initialize YouTube Player & live postMessage listener
  useEffect(() => {
    let alive = true;
    let pollInterval: NodeJS.Timeout | null = null;

    // Listen to iframe postMessages for live currentTime
    const handleMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.event === "infoDelivery" && typeof data?.info?.currentTime === "number") {
          const sec = Math.round(data.info.currentTime);
          liveSecondsRef.current = sec;
          setLiveSeconds(sec);
        }
      } catch {
        // Ignore non-JSON postmessages
      }
    };

    window.addEventListener("message", handleMessage);

    void loadYouTubeApi().then(() => {
      if (!alive) return;
      if (!window.YT?.Player) return;

      const containerId = `yt-player-${elementId}`;
      const containerElem = document.getElementById(containerId);
      if (!containerElem) return;

      try {
        const playerInstance = new window.YT.Player(containerId, {
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
            onReady: (event) => {
              if (!alive) return;
              playerRef.current = event.target;
              setPlayerReady(true);

              pollInterval = setInterval(() => {
                try {
                  if (playerRef.current?.getCurrentTime) {
                    const sec = Math.round(playerRef.current.getCurrentTime());
                    if (sec !== liveSecondsRef.current) {
                      liveSecondsRef.current = sec;
                      setLiveSeconds(sec);
                    }
                  }
                } catch {
                  // Ignore
                }
              }, 500);
            },
          },
        });
      } catch {
        // Fallback
      }
    });

    return () => {
      alive = false;
      window.removeEventListener("message", handleMessage);
      if (pollInterval) clearInterval(pollInterval);
      if (playerRef.current?.destroy) {
        try {
          playerRef.current.destroy();
        } catch {
          // Ignore
        }
      }
      playerRef.current = null;
      setPlayerReady(false);
    };
  }, [videoId, elementId]);

  const getCurrentSeconds = useCallback((): number => {
    if (playerRef.current?.getCurrentTime) {
      try {
        const sec = Math.round(playerRef.current.getCurrentTime());
        if (sec > 0) {
          liveSecondsRef.current = sec;
          setLiveSeconds(sec);
          return sec;
        }
      } catch {
        // Fallback
      }
    }
    return liveSecondsRef.current;
  }, []);

  const seekTo = useCallback(
    (seconds: number) => {
      liveSecondsRef.current = seconds;
      setLiveSeconds(seconds);
      setTargetTimestamp(seconds);

      if (playerRef.current?.seekTo) {
        try {
          playerRef.current.seekTo(seconds, true);
          return;
        } catch {
          // Fallback
        }
      }

      if (iframeRef.current) {
        iframeRef.current.src = getYouTubeEmbedUrl(videoId, { autoplay: true, start: seconds });
      }
    },
    [videoId],
  );

  const addNote = useMutation({
    mutationFn: () => {
      const sec = targetTimestamp > 0 ? targetTimestamp : getCurrentSeconds();
      return createVideoNote({
        resource_id: resourceId,
        seconds: sec,
        note: note.trim(),
      });
    },
    onSuccess: () => {
      setNote("");
      setTargetTimestamp(0);
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
    setTargetTimestamp(seconds);
    setAutoLoading(true);
    try {
      const result = await runAutoNote({ data: { videoId, resourceId, seconds } });
      if (result.success && result.note) {
        setNote(result.note);
        toast.success(`Note generated for ${formatVideoTimestamp(seconds)}!`);
      } else {
        toast.error(result.error ?? "Could not generate note for this timestamp");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate note");
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
          <div id={`yt-player-${elementId}`} className="size-full">
            <iframe
              ref={iframeRef}
              src={getYouTubeEmbedUrl(videoId, { autoplay: false })}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="size-full border-0"
            />
          </div>
        </div>
      </div>

      {/* Action header with Live Time and Open on YouTube */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1 text-xs font-bold tabular-nums text-primary">
            <Clock className="size-3.5" />
            Current: {formatVideoTimestamp(liveSeconds)}
          </span>
          <span className="text-xs text-muted-foreground">
            {playerReady ? "• Live player connected" : "• Video ready"}
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
              onClick={() => setMode("auto")}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-semibold transition-colors ${
                mode === "auto"
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Wand2 className="size-3" /> Auto (from transcript)
            </button>
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
          </div>

          {/* Note Form */}
          <form className="card-soft flex flex-col gap-3 p-5" onSubmit={handleSubmit}>
            {mode === "auto" && (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  className="press gap-2 rounded-2xl text-sm font-medium"
                  onClick={() => void handleAutoNote()}
                  disabled={autoLoading}
                >
                  {autoLoading ? (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  ) : (
                    <Sparkle className="size-4 text-primary" />
                  )}
                  {autoLoading
                    ? `Generating note for ${formatVideoTimestamp(targetTimestamp || liveSeconds)}…`
                    : `Generate note for ${formatVideoTimestamp(liveSeconds)}`}
                </Button>
                {targetTimestamp > 0 && (
                  <span className="text-xs text-primary font-semibold">
                    Targeted at {formatVideoTimestamp(targetTimestamp)}
                  </span>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  mode === "auto"
                    ? "Auto-generated note will appear here (edit before saving)…"
                    : `Type your note for ${formatVideoTimestamp(liveSeconds)}…`
                }
                className="min-w-40 flex-1 rounded-2xl h-11 text-base"
              />
              <Button
                type="submit"
                className="press gap-2 rounded-2xl h-11 px-5 text-base font-semibold"
                disabled={!note.trim() || addNote.isPending}
              >
                <Plus className="size-5" /> Pin note at {formatVideoTimestamp(targetTimestamp || liveSeconds)}
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
              <li className="rounded-2xl border border-dashed border-border py-12 text-center text-base text-muted-foreground">
                No notes yet. Click &quot;Generate note&quot; while listening to save key takeaways!
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
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
                placeholder="Search across video transcript…"
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
                      setTargetTimestamp(s.offset);
                      setActiveTab("notes");
                      toast.info(`Quote at ${formatVideoTimestamp(s.offset)} loaded into note creator`);
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
