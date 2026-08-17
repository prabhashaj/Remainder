import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Clock,
  ExternalLink,
  Loader2,
  Pen,
  Play,
  Plus,
  RotateCcw,
  Sparkle,
  Trash2,
  Wand2,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createVideoNote, deleteVideoNote, fetchVideoNotes } from "@/lib/study";
import { autoNoteFromTranscript } from "@/lib/study.functions";
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

type NoteMode = "auto" | "manual";

/**
 * A streamlined YouTube study player with live time-synced notes
 * and automatic timestamp extraction.
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
  const containerRef = useRef<HTMLDivElement>(null);
  const liveSecondsRef = useRef<number>(0);

  const [playerReady, setPlayerReady] = useState(false);
  const [liveSeconds, setLiveSeconds] = useState<number>(0);
  const [manualTimeStr, setManualTimeStr] = useState<string>("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<NoteMode>("auto");
  const [autoLoading, setAutoLoading] = useState(false);

  const runAutoNote = useServerFn(autoNoteFromTranscript);

  const { data: notes = [] } = useQuery({
    queryKey: ["video-notes", resourceId],
    queryFn: () => fetchVideoNotes(resourceId),
  });

  const refreshNotes = () => void qc.invalidateQueries({ queryKey: ["video-notes", resourceId] });

  // Initialize YouTube Player API directly on the container div
  useEffect(() => {
    let alive = true;
    let pollInterval: NodeJS.Timeout | null = null;

    // Listen to iframe postMessages for live currentTime
    const handleMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.event === "infoDelivery" && typeof data?.info?.currentTime === "number") {
          const sec = Math.round(data.info.currentTime);
          if (sec >= 0) {
            liveSecondsRef.current = sec;
            setLiveSeconds(sec);
          }
        }
      } catch {
        // Ignore
      }
    };

    window.addEventListener("message", handleMessage);

    void loadYouTubeApi().then(() => {
      if (!alive || !containerRef.current) return;
      if (!window.YT?.Player) return;

      try {
        const playerInstance = new window.YT.Player(containerRef.current, {
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

              // Poll currentTime continuously while active
              pollInterval = setInterval(() => {
                try {
                  if (playerRef.current?.getCurrentTime) {
                    const sec = Math.round(playerRef.current.getCurrentTime());
                    if (!isNaN(sec) && sec >= 0 && sec !== liveSecondsRef.current) {
                      liveSecondsRef.current = sec;
                      setLiveSeconds(sec);
                    }
                  }
                } catch {
                  // Ignore
                }
              }, 300);
            },
            onStateChange: (event) => {
              if (playerRef.current?.getCurrentTime) {
                const sec = Math.round(playerRef.current.getCurrentTime());
                if (!isNaN(sec) && sec >= 0) {
                  liveSecondsRef.current = sec;
                  setLiveSeconds(sec);
                }
              }
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
  }, [videoId]);

  const parseSecondsFromString = (str: string): number => {
    const clean = str.trim();
    if (!clean) return liveSeconds;
    const parts = clean.split(":").map((p) => parseInt(p, 10));
    if (parts.length === 2 && !isNaN(parts[0]!) && !isNaN(parts[1]!)) {
      return parts[0]! * 60 + parts[1]!;
    }
    if (parts.length === 3 && !isNaN(parts[0]!) && !isNaN(parts[1]!) && !isNaN(parts[2]!)) {
      return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
    }
    const num = parseInt(clean, 10);
    return isNaN(num) ? liveSeconds : num;
  };

  const getEffectiveSeconds = useCallback((): number => {
    if (manualTimeStr) {
      return parseSecondsFromString(manualTimeStr);
    }
    if (playerRef.current?.getCurrentTime) {
      try {
        const sec = Math.round(playerRef.current.getCurrentTime());
        if (!isNaN(sec) && sec >= 0) {
          liveSecondsRef.current = sec;
          setLiveSeconds(sec);
          return sec;
        }
      } catch {
        // Fallback
      }
    }
    return liveSecondsRef.current;
  }, [manualTimeStr, liveSeconds]);

  const seekTo = useCallback(
    (seconds: number) => {
      liveSecondsRef.current = seconds;
      setLiveSeconds(seconds);
      setManualTimeStr(formatVideoTimestamp(seconds));

      if (playerRef.current?.seekTo) {
        try {
          playerRef.current.seekTo(seconds, true);
        } catch {
          // Ignore
        }
      }
    },
    [],
  );

  const addNote = useMutation({
    mutationFn: () => {
      const sec = getEffectiveSeconds();
      return createVideoNote({
        resource_id: resourceId,
        seconds: sec,
        note: note.trim(),
      });
    },
    onSuccess: () => {
      setNote("");
      setManualTimeStr("");
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
    const seconds = getEffectiveSeconds();
    setAutoLoading(true);
    try {
      const result = await runAutoNote({ data: { videoId, resourceId, seconds } });
      if (result.success && result.note) {
        setNote(result.note);
        setManualTimeStr(formatVideoTimestamp(seconds));
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

  const currentDisplayTime = manualTimeStr || formatVideoTimestamp(liveSeconds);

  return (
    <div className="space-y-5">
      {/* YouTube Player Container */}
      <div className="overflow-hidden rounded-3xl border border-border bg-black shadow-soft">
        <div className="aspect-video w-full relative">
          <div ref={containerRef} className="size-full" />
        </div>
      </div>

      {/* Action header with Live Time and Open on YouTube */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1 text-xs font-bold tabular-nums text-primary">
            <Clock className="size-3.5" />
            Current: {currentDisplayTime}
          </span>
          <span className="text-xs text-muted-foreground">
            {playerReady ? "• Live player connected" : "• Loading player…"}
          </span>
        </div>
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 rounded-xl text-xs">
          <a href={getYouTubeWatchUrl(videoId)} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" /> Watch on YouTube
          </a>
        </Button>
      </div>

      {/* Direct Mode Selection (Auto vs Manual) */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => setMode("auto")}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition-all ${
            mode === "auto"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <Wand2 className="size-4" /> Auto (from transcript)
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition-all ${
            mode === "manual"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <Pen className="size-4" /> Manual Note
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
                ? `Generating note for ${currentDisplayTime}…`
                : `Generate note for ${currentDisplayTime}`}
            </Button>
            {manualTimeStr && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 rounded-xl text-xs text-muted-foreground"
                onClick={() => setManualTimeStr("")}
              >
                <RotateCcw className="size-3" /> Sync with live video
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              mode === "auto"
                ? `Auto-generated note for ${currentDisplayTime} will appear here…`
                : `Type your note for ${currentDisplayTime}…`
            }
            className="min-w-40 flex-1 rounded-2xl h-11 text-base"
          />
          <Button
            type="submit"
            className="press gap-2 rounded-2xl h-11 px-5 text-base font-semibold"
            disabled={!note.trim() || addNote.isPending}
          >
            <Plus className="size-5" /> Pin note at {currentDisplayTime}
          </Button>
        </div>
      </form>

      {/* Timestamped Notes List */}
      <ul className="space-y-3 pt-2">
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
  );
}
