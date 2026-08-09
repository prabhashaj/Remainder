import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Clock, Loader2, Pen, Plus, Sparkle, Trash2, Wand2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createVideoNote, deleteVideoNote, fetchVideoNotes, formatClock } from "@/lib/study";
import { autoNoteFromTranscript } from "@/lib/study.functions";

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

let ytApiLoaded = false;
let ytApiCallbacks: Array<() => void> = [];

function loadYouTubeApi(): Promise<void> {
  if (ytApiLoaded && window.YT?.Player) return Promise.resolve();
  return new Promise<void>((resolve) => {
    if (window.YT?.Player) {
      ytApiLoaded = true;
      resolve();
      return;
    }
    ytApiCallbacks.push(resolve);
    if (ytApiCallbacks.length === 1) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = () => {
        ytApiLoaded = true;
        const cbs = ytApiCallbacks;
        ytApiCallbacks = [];
        cbs.forEach((cb) => cb());
      };
    }
  });
}

type NoteMode = "manual" | "auto";

/**
 * A YouTube player with the IFrame Player API for real timestamped notes.
 * Click a note's timestamp badge to jump the video to that moment.
 * "Auto Note" fetches the transcript at the current timestamp.
 */
export function VideoNotes({
  resourceId,
  videoId,
  title,
}: {
  resourceId: string;
  videoId: string;
  title: string;
}) {
  const qc = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<NoteMode>("manual");
  const [autoLoading, setAutoLoading] = useState(false);
  const runAutoNote = useServerFn(autoNoteFromTranscript);

  const { data: notes = [] } = useQuery({
    queryKey: ["video-notes", resourceId],
    queryFn: () => fetchVideoNotes(resourceId),
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ["video-notes", resourceId] });

  // Initialize YouTube Player
  useEffect(() => {
    let alive = true;
    let player: YTPlayer | null = null;

    void loadYouTubeApi().then(() => {
      if (!alive || !containerRef.current || !window.YT?.Player) return;
      player = new window.YT.Player(containerRef.current, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
        },
        events: {
          onReady: () => {
            if (alive) {
              playerRef.current = player;
              setPlayerReady(true);
            }
          },
        },
      });
    });

    return () => {
      alive = false;
      if (player?.destroy) {
        try {
          player.destroy();
        } catch {
          /* player may already be gone */
        }
      }
      playerRef.current = null;
      setPlayerReady(false);
    };
  }, [videoId]);

  const getCurrentSeconds = useCallback((): number => {
    if (playerRef.current?.getCurrentTime) {
      return Math.round(playerRef.current.getCurrentTime());
    }
    return 0;
  }, []);

  const seekTo = useCallback((seconds: number) => {
    if (playerRef.current?.seekTo) {
      playerRef.current.seekTo(seconds, true);
    }
  }, []);

  const add = useMutation({
    mutationFn: () =>
      createVideoNote({
        resource_id: resourceId,
        seconds: getCurrentSeconds(),
        note: note.trim(),
      }),
    onSuccess: () => {
      setNote("");
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: deleteVideoNote,
    onSuccess: refresh,
  });

  const handleAutoNote = async () => {
    const seconds = getCurrentSeconds();
    setAutoLoading(true);
    try {
      const result = await runAutoNote({ data: { videoId, resourceId, seconds } });
      if (result.success && result.note) {
        setNote(result.note);
        toast.success("Note generated from transcript");
      } else {
        toast.error(result.error ?? "No transcript at this timestamp");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to get transcript");
    } finally {
      setAutoLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (note.trim()) add.mutate();
  };

  return (
    <div className="space-y-4">
      {/* YouTube Player */}
      <div className="overflow-hidden rounded-3xl border border-border">
        <div className="aspect-video w-full">
          <div ref={containerRef} className="size-full" />
        </div>
      </div>

      {/* Current Time Display */}
      {playerReady && (
        <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
          <Clock className="size-4 text-primary" />
          <span>Video ready — notes will auto-capture the current playback time</span>
        </div>
      )}

      {/* Note Mode Switcher */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            mode === "manual"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <Pen className="size-4" /> Manual
        </button>
        <button
          type="button"
          onClick={() => setMode("auto")}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            mode === "auto"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <Wand2 className="size-4" /> Auto (from transcript)
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
            disabled={autoLoading || !playerReady}
          >
            {autoLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkle className="size-4" />
            )}
            {autoLoading ? "Fetching transcript…" : "Generate note at current time"}
          </Button>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              mode === "auto"
                ? "Auto-generated note (edit before saving)…"
                : "Type your note at the current video time…"
            }
            className="min-w-40 flex-1 rounded-2xl h-11 text-base"
          />
          <Button
            type="submit"
            className="press gap-2 rounded-2xl h-11 px-5 text-base font-semibold"
            disabled={!note.trim() || add.isPending}
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
            className="flex items-start gap-3 rounded-2xl border border-border px-4 py-3.5"
          >
            <button
              type="button"
              onClick={() => seekTo(n.seconds)}
              className="press rounded-xl bg-primary/10 px-2.5 py-1.5 text-sm font-bold tabular-nums text-primary transition-colors hover:bg-primary/20"
              title="Click to jump to this timestamp"
            >
              {formatClock(n.seconds)}
            </button>
            <p className="min-w-0 flex-1 text-base leading-relaxed text-foreground">{n.note}</p>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete note"
              onClick={() => remove.mutate(n.id)}
              className="rounded-xl text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
        {notes.length === 0 && (
          <li className="rounded-2xl bg-muted/50 px-5 py-8 text-center text-base text-muted-foreground">
            <BookOpen className="mx-auto mb-2 size-6 text-primary" />
            Pin your first note — it captures the exact video timestamp so you can jump back later.
          </li>
        )}
      </ul>
    </div>
  );
}
