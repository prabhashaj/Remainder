import { useQueryClient } from "@tanstack/react-query";
import { Pause, Play, RotateCcw, Timer, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createFocusSession, finishFocusSession } from "@/lib/db";

const STORAGE_KEY = "remainder.focus.timer";
const PRESETS = [15, 25, 45, 60];

type TimerState = {
  minutes: number;
  secondsLeft: number;
  running: boolean;
  title: string;
  sessionId: string | null;
} | null;

type Ctx = {
  state: TimerState;
  start: (minutes: number, title: string, itemId?: string | null) => void;
  toggle: () => void;
  reset: () => void;
  remove: () => void;
};

const FocusTimerContext = createContext<Ctx | null>(null);

export function useFocusTimer(): Ctx {
  const ctx = useContext(FocusTimerContext);
  if (!ctx) throw new Error("useFocusTimer must be used inside FocusTimerProvider");
  return ctx;
}

/**
 * A single focus timer that lives above the router, so it keeps running while
 * the user moves between pages and can be started or removed from anywhere.
 */
export function FocusTimerProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [state, setState] = useState<TimerState>(null);
  const hydrated = useRef(false);

  // Restore any timer left over from a previous page/session.
  useEffect(() => {
    if (hydrated.current || typeof window === "undefined") return;
    hydrated.current = true;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as NonNullable<TimerState> & {
        savedAt?: number;
      };
      const elapsed = saved.running && saved.savedAt
        ? Math.floor((Date.now() - saved.savedAt) / 1000)
        : 0;
      const secondsLeft = Math.max(0, saved.secondsLeft - elapsed);
      setState({ ...saved, secondsLeft, running: saved.running && secondsLeft > 0 });
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !hydrated.current) return;
    if (!state) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...state, savedAt: Date.now() }),
    );
  }, [state]);

  // Tick.
  useEffect(() => {
    if (!state?.running) return;
    const id = window.setInterval(() => {
      setState((prev) => {
        if (!prev?.running) return prev;
        if (prev.secondsLeft <= 1) return { ...prev, secondsLeft: 0, running: false };
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [state?.running]);

  const done = state?.secondsLeft === 0;
  const celebrated = useRef(false);
  useEffect(() => {
    if (!done) {
      celebrated.current = false;
      return;
    }
    if (celebrated.current || !state) return;
    celebrated.current = true;
    toast.success(`Nice — ${state.minutes} focused minutes on "${state.title}".`);
    if (state.sessionId) {
      void finishFocusSession(state.sessionId, { minutes: state.minutes }).then(
        () => void qc.invalidateQueries({ queryKey: ["focus"] }),
      );
    }
  }, [done, state, qc]);

  const start = useCallback(
    (minutes: number, title: string, itemId?: string | null) => {
      const label = title.trim() || "Focus session";
      setState({
        minutes,
        secondsLeft: minutes * 60,
        running: true,
        title: label,
        sessionId: null,
      });
      void createFocusSession({
        title: label,
        roadmap_item_id: itemId ?? null,
      })
        .then((session) => {
          setState((prev) => (prev ? { ...prev, sessionId: session.id } : prev));
          void qc.invalidateQueries({ queryKey: ["focus"] });
        })
        .catch(() => {
          /* timer still works even if logging fails */
        });
    },
    [qc],
  );

  const toggle = useCallback(
    () =>
      setState((prev) =>
        prev && prev.secondsLeft > 0 ? { ...prev, running: !prev.running } : prev,
      ),
    [],
  );

  const reset = useCallback(
    () =>
      setState((prev) =>
        prev ? { ...prev, secondsLeft: prev.minutes * 60, running: false } : prev,
      ),
    [],
  );

  const remove = useCallback(() => {
    setState((prev) => {
      if (prev?.sessionId) {
        const spent = Math.max(0, Math.round((prev.minutes * 60 - prev.secondsLeft) / 60));
        void finishFocusSession(prev.sessionId, { minutes: spent }).then(
          () => void qc.invalidateQueries({ queryKey: ["focus"] }),
        );
      }
      return null;
    });
  }, [qc]);

  const value = useMemo(
    () => ({ state, start, toggle, reset, remove }),
    [state, start, toggle, reset, remove],
  );

  return (
    <FocusTimerContext.Provider value={value}>
      {children}
    </FocusTimerContext.Provider>
  );
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Header control: start a timer in two clicks from any page. */
export function FocusTimerButton({ defaultTitle = "" }: { defaultTitle?: string }) {
  const { state, start, toggle, reset, remove } = useFocusTimer();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [custom, setCustom] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={state ? "secondary" : "ghost"}
          className="press h-9 gap-1.5 rounded-2xl px-3"
        >
          <Timer className="size-4" />
          <span className="text-sm tabular-nums">
            {state ? clock(state.secondsLeft) : "Focus"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 rounded-3xl p-4">
        {state ? (
          <div>
            <p className="truncate text-sm font-semibold">{state.title}</p>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums">
              {clock(state.secondsLeft)}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                className="press flex-1 gap-1.5 rounded-2xl"
                onClick={toggle}
                disabled={state.secondsLeft === 0}
              >
                {state.running ? (
                  <>
                    <Pause className="size-3.5" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="size-3.5" /> Resume
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="press rounded-2xl"
                onClick={reset}
                aria-label="Reset timer"
              >
                <RotateCcw className="size-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="press rounded-2xl text-muted-foreground"
                onClick={() => {
                  remove();
                  setOpen(false);
                }}
                aria-label="Remove timer"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold">Start a focus session</p>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What are you focusing on?"
              className="mt-3 rounded-2xl"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant="secondary"
                  className="press rounded-2xl"
                  onClick={() => {
                    start(m, title);
                    setOpen(false);
                  }}
                >
                  {m}m
                </Button>
              ))}
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const m = Number(custom);
                if (!Number.isFinite(m) || m <= 0) return;
                start(Math.min(240, Math.round(m)), title);
                setCustom("");
                setOpen(false);
              }}
            >
              <Input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Custom minutes"
                inputMode="numeric"
                className="rounded-2xl"
              />
              <Button type="submit" size="sm" className="press rounded-2xl">
                Start
              </Button>
            </form>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Small always-visible chip so a running timer is never lost. */
export function FocusTimerChip() {
  const { state, toggle, remove } = useFocusTimer();
  if (!state) return null;

  return (
    <div className="pointer-events-auto fixed right-3 top-16 z-40 flex items-center gap-2 rounded-full border border-border/70 bg-card/95 px-3 py-1.5 shadow-[0_10px_30px_-18px_hsl(var(--foreground)/0.4)] backdrop-blur sm:right-6">
      <Timer className="size-3.5 text-primary" />
      <span className="max-w-[9rem] truncate text-xs text-muted-foreground">
        {state.title}
      </span>
      <span className="text-sm font-semibold tabular-nums">
        {clock(state.secondsLeft)}
      </span>
      <button
        type="button"
        onClick={toggle}
        aria-label={state.running ? "Pause timer" : "Resume timer"}
        className="rounded-full p-1 text-muted-foreground hover:bg-muted"
      >
        {state.running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
      </button>
      <button
        type="button"
        onClick={remove}
        aria-label="Remove timer"
        className="rounded-full p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
