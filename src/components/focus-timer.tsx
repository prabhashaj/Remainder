import { useQueryClient } from "@tanstack/react-query";
import { Coffee, Pause, Play, RotateCcw, Sparkles, Timer, X } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createFocusSession, finishFocusSession } from "@/lib/db";

const STORAGE_KEY = "remainder.focus.timer";
const PRESETS = [15, 25, 45, 60];

type TimerState = {
  minutes: number;
  secondsLeft: number;
  running: boolean;
  title: string;
  intention?: string | undefined;
  sessionId: string | null;
  sessionType: "single" | "pomodoro";
  isBreak: boolean;
  cycleCount: number;
  tabAwayCount: number;
  tabAwaySeconds: number;
};

type StartOptions = {
  minutes: number;
  title: string;
  intention?: string | undefined;
  sessionType?: "single" | "pomodoro" | undefined;
  itemId?: string | null | undefined;
};

type Ctx = {
  state: TimerState | null;
  start: (
    optsOrMinutes: number | StartOptions,
    title?: string,
    itemId?: string | null,
  ) => void;
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

export function FocusTimerProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [state, setState] = useState<TimerState | null>(null);
  const hydrated = useRef(false);

  // Post-session reflection dialog state
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [completedSessionInfo, setCompletedSessionInfo] = useState<{
    id: string | null;
    title: string;
    minutes: number;
    intention?: string | undefined;
    tabAwayCount: number;
  } | null>(null);
  const [stayedOnTask, setStayedOnTask] = useState<boolean | null>(null);
  const [reflectionNote, setReflectionNote] = useState("");

  // Tab away detection
  const tabAwayStart = useRef<number | null>(null);

  useEffect(() => {
    function handleVisibilityChange() {
      if (!state?.running) return;

      if (document.hidden) {
        tabAwayStart.current = Date.now();
      } else if (tabAwayStart.current) {
        const awayMs = Date.now() - tabAwayStart.current;
        const awaySec = Math.round(awayMs / 1000);
        tabAwayStart.current = null;

        setState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            tabAwayCount: prev.tabAwayCount + 1,
            tabAwaySeconds: prev.tabAwaySeconds + awaySec,
          };
        });
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [state?.running]);

  // Restore timer
  useEffect(() => {
    if (hydrated.current || typeof window === "undefined") return;
    hydrated.current = true;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as NonNullable<TimerState> & {
        savedAt?: number;
      };
      const elapsed =
        saved.running && saved.savedAt
          ? Math.floor((Date.now() - saved.savedAt) / 1000)
          : 0;
      const secondsLeft = Math.max(0, saved.secondsLeft - elapsed);
      setState({
        ...saved,
        secondsLeft,
        running: saved.running && secondsLeft > 0,
      });
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

  // Tick
  useEffect(() => {
    if (!state?.running) return;
    const id = window.setInterval(() => {
      setState((prev) => {
        if (!prev?.running) return prev;
        if (prev.secondsLeft <= 1) {
          // Check Pomodoro cycle switch
          if (prev.sessionType === "pomodoro") {
            if (!prev.isBreak) {
              // Transition Work -> Break (5 mins)
              toast.info("Work cycle complete! Time for a 5-minute break ☕");
              return {
                ...prev,
                isBreak: true,
                secondsLeft: 5 * 60,
                running: true,
                cycleCount: prev.cycleCount + 1,
              };
            } else {
              // Transition Break -> Work (25 mins)
              toast.info("Break complete! Ready for another focus cycle 🚀");
              return {
                ...prev,
                isBreak: false,
                secondsLeft: 25 * 60,
                running: true,
              };
            }
          }

          return { ...prev, secondsLeft: 0, running: false };
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [state?.running]);

  // Session complete triggers reflection prompt
  const done = state?.secondsLeft === 0 && !state?.isBreak;
  const celebrated = useRef(false);
  useEffect(() => {
    if (!done) {
      celebrated.current = false;
      return;
    }
    if (celebrated.current || !state) return;
    celebrated.current = true;

    const info: {
      id: string | null;
      title: string;
      minutes: number;
      intention?: string | undefined;
      tabAwayCount: number;
    } = {
      id: state.sessionId,
      title: state.title,
      minutes: state.minutes,
      tabAwayCount: state.tabAwayCount,
    };
    if (state.intention) {
      info.intention = state.intention;
    }

    setCompletedSessionInfo(info);
    setStayedOnTask(null);
    setReflectionNote("");
    setReflectionOpen(true);
  }, [done, state]);

  const start = useCallback(
    (
      optsOrMinutes: number | StartOptions,
      titleParam?: string,
      itemIdParam?: string | null,
    ) => {
      let minutes: number;
      let label: string;
      let intention: string | undefined;
      let sessionType: "single" | "pomodoro" = "single";
      let itemId: string | null = null;

      if (typeof optsOrMinutes === "object") {
        minutes = optsOrMinutes.minutes;
        label = optsOrMinutes.title.trim() || "Focus session";
        intention = optsOrMinutes.intention?.trim() || undefined;
        sessionType = optsOrMinutes.sessionType ?? "single";
        itemId = optsOrMinutes.itemId ?? null;
      } else {
        minutes = optsOrMinutes;
        label = (titleParam ?? "").trim() || "Focus session";
        itemId = itemIdParam ?? null;
      }

      const newState: TimerState = {
        minutes,
        secondsLeft: minutes * 60,
        running: true,
        title: label,
        sessionId: null,
        sessionType,
        isBreak: false,
        cycleCount: 0,
        tabAwayCount: 0,
        tabAwaySeconds: 0,
      };
      if (intention) {
        newState.intention = intention;
      }

      setState(newState);

      void createFocusSession({
        title: label,
        roadmap_item_id: itemId,
        intention: intention || null,
        session_type: sessionType,
        work_minutes: minutes,
        break_minutes: sessionType === "pomodoro" ? 5 : 0,
      })
        .then((session) => {
          setState((prev) => (prev ? { ...prev, sessionId: session.id } : prev));
          void qc.invalidateQueries({ queryKey: ["focus"] });
        })
        .catch(() => {
          /* timer works offline */
        });
    },
    [qc],
  );

  const toggle = useCallback(
    () =>
      setState((prev) =>
        prev && prev.secondsLeft > 0
          ? { ...prev, running: !prev.running }
          : prev,
      ),
    [],
  );

  const reset = useCallback(
    () =>
      setState((prev) =>
        prev
          ? { ...prev, secondsLeft: prev.minutes * 60, running: false }
          : prev,
      ),
    [],
  );

  const remove = useCallback(() => {
    setState((prev) => {
      if (prev?.sessionId) {
        const spent = Math.max(
          0,
          Math.round((prev.minutes * 60 - prev.secondsLeft) / 60),
        );
        void finishFocusSession(prev.sessionId, {
          minutes: spent,
          tab_away_count: prev.tabAwayCount,
          tab_away_seconds: prev.tabAwaySeconds,
        }).then(() => void qc.invalidateQueries({ queryKey: ["focus"] }));
      }
      return null;
    });
  }, [qc]);

  const handleSaveReflection = () => {
    if (completedSessionInfo?.id) {
      void finishFocusSession(completedSessionInfo.id, {
        minutes: completedSessionInfo.minutes,
        reflection: reflectionNote.trim() || null,
        stayed_on_task: stayedOnTask,
        tab_away_count: completedSessionInfo.tabAwayCount,
      }).then(() => void qc.invalidateQueries({ queryKey: ["focus"] }));
    }
    toast.success(
      `Saved! Great ${completedSessionInfo?.minutes} minute session.`,
    );
    setReflectionOpen(false);
    setState(null);
  };

  const value = useMemo(
    () => ({ state, start, toggle, reset, remove }),
    [state, start, toggle, reset, remove],
  );

  return (
    <FocusTimerContext.Provider value={value}>
      {children}

      <Dialog open={reflectionOpen} onOpenChange={setReflectionOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-bold flex items-center gap-2">
              <Sparkles className="size-5 text-primary" /> Focus Reflection
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              You completed{" "}
              <strong className="text-foreground">
                {completedSessionInfo?.minutes} minutes
              </strong>{" "}
              on &quot;{completedSessionInfo?.title}&quot;.
            </p>

            {completedSessionInfo?.intention && (
              <div className="rounded-xl bg-muted/60 p-3 text-xs">
                <span className="font-semibold text-muted-foreground">
                  Your intention was:
                </span>
                <p className="mt-0.5 text-foreground">
                  {completedSessionInfo.intention}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Did you stay on task?
              </p>
              <div className="flex gap-2">
                {[
                  { label: "Yes, focused", value: true },
                  { label: "Mostly", value: true },
                  { label: "Got distracted", value: false },
                ].map((opt, i) => (
                  <Button
                    key={i}
                    size="sm"
                    variant={stayedOnTask === opt.value ? "default" : "outline"}
                    className="press rounded-2xl flex-1 text-xs"
                    onClick={() => setStayedOnTask(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                One-line reflection (optional)
              </p>
              <Input
                value={reflectionNote}
                onChange={(e) => setReflectionNote(e.target.value)}
                placeholder="What did you get done? Any takeaways?"
                className="rounded-2xl"
              />
            </div>

            <Button
              className="press w-full rounded-2xl mt-2"
              onClick={handleSaveReflection}
            >
              Complete Session
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </FocusTimerContext.Provider>
  );
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function FocusTimerButton({ defaultTitle = "" }: { defaultTitle?: string }) {
  const { state, start, toggle, reset, remove } = useFocusTimer();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [intention, setIntention] = useState("");
  const [custom, setCustom] = useState("");
  const [isPomodoro, setIsPomodoro] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={state ? (state.isBreak ? "outline" : "secondary") : "ghost"}
          className={`press h-9 gap-1.5 rounded-2xl px-3 ${state?.isBreak ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300" : ""}`}
        >
          {state?.isBreak ? (
            <Coffee className="size-4 animate-pulse text-amber-600" />
          ) : (
            <Timer className="size-4" />
          )}
          <span className="text-sm tabular-nums">
            {state
              ? `${state.isBreak ? "Break " : ""}${clock(state.secondsLeft)}`
              : "Focus"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-3xl p-4">
        {state ? (
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                {state.isBreak
                  ? "Break Time"
                  : state.sessionType === "pomodoro"
                    ? `Pomodoro Cycle #${state.cycleCount + 1}`
                    : "Single Session"}
              </span>
              {state.tabAwayCount > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {state.tabAwayCount} tab shift
                  {state.tabAwayCount === 1 ? "" : "s"}
                </span>
              )}
            </div>

            <p className="truncate text-sm font-semibold mt-1">{state.title}</p>
            {state.intention && (
              <p className="text-xs text-muted-foreground truncate">
                Target: {state.intention}
              </p>
            )}

            <p className="mt-2 font-display text-3xl font-bold tabular-nums">
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

            <div className="mt-3 space-y-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What are you focusing on?"
                className="rounded-2xl"
              />
              <Input
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                placeholder="What does done look like? (intention)"
                className="rounded-2xl text-xs"
              />
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPomodoro}
                  onChange={(e) => setIsPomodoro(e.target.checked)}
                  className="rounded border-border"
                />
                Pomodoro Mode (25m / 5m)
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant="secondary"
                  className="press rounded-2xl"
                  onClick={() => {
                    start({
                      minutes: isPomodoro ? 25 : m,
                      title,
                      intention,
                      sessionType: isPomodoro ? "pomodoro" : "single",
                    });
                    setOpen(false);
                  }}
                >
                  {isPomodoro ? "25m Pomo" : `${m}m`}
                </Button>
              ))}
            </div>

            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const m = Number(custom);
                if (!Number.isFinite(m) || m <= 0) return;
                start({
                  minutes: Math.min(240, Math.round(m)),
                  title,
                  intention,
                  sessionType: isPomodoro ? "pomodoro" : "single",
                });
                setCustom("");
                setOpen(false);
              }}
            >
              <Input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Custom min"
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

export function FocusTimerChip() {
  const { state, toggle, remove } = useFocusTimer();
  if (!state) return null;

  return (
    <div className="pointer-events-auto fixed right-3 top-16 z-40 flex items-center gap-2 rounded-full border border-border/70 bg-card/95 px-3 py-1.5 shadow-[0_10px_30px_-18px_hsl(var(--foreground)/0.4)] backdrop-blur sm:right-6">
      {state.isBreak ? (
        <Coffee className="size-3.5 text-amber-500 animate-pulse" />
      ) : (
        <Timer className="size-3.5 text-primary" />
      )}
      <span className="max-w-[9rem] truncate text-xs text-muted-foreground">
        {state.isBreak ? "Break" : state.title}
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
        {state.running ? (
          <Pause className="size-3.5" />
        ) : (
          <Play className="size-3.5" />
        )}
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
