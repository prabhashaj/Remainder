import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  createFocusSession,
  fetchFocusSessions,
  fetchRoadmapItems,
  fetchRoadmaps,
  finishFocusSession,
} from "@/lib/db";

type FocusSearch = { item: string };

export const Route = createFileRoute("/_authenticated/focus")({
  validateSearch: (search: Record<string, unknown>): FocusSearch => ({
    item: typeof search["item"] === "string" ? search["item"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Focus — Remispace" },
      {
        name: "description",
        content: "A distraction-free timer with notes, kept inside your workspace.",
      },
      { property: "og:title", content: "Focus — Remispace" },
      { property: "og:description", content: "Focused learning sessions inside Remispace." },
    ],
  }),
  component: FocusPage,
});

const LENGTHS = [15, 25, 45, 60];

function FocusPage() {
  const qc = useQueryClient();
  const { item } = Route.useSearch();

  const [minutes, setMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const sessionIdRef = useRef<string | null>(null);

  const { data: roadmaps = [] } = useQuery({ queryKey: ["roadmaps"], queryFn: fetchRoadmaps });
  const firstRoadmapId = roadmaps[0]?.id;
  const { data: items = [] } = useQuery({
    queryKey: ["roadmap-items", firstRoadmapId],
    queryFn: () => fetchRoadmapItems(firstRoadmapId as string),
    enabled: Boolean(firstRoadmapId),
  });
  const { data: sessions = [] } = useQuery({ queryKey: ["focus"], queryFn: fetchFocusSessions });

  const linkedItem = useMemo(() => items.find((i) => i.id === item), [items, item]);
  useEffect(() => {
    if (linkedItem && !title) {
      setTitle(linkedItem.title);
      if (linkedItem.resource_url) setUrl(linkedItem.resource_url);
    }
  }, [linkedItem, title]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const start = useMutation({
    mutationFn: async () => {
      const session = await createFocusSession({
        title: title.trim() || "Focus session",
        resource_kind: url ? "link" : "none",
        resource_url: url.trim() || null,
        roadmap_item_id: item || null,
      });
      return session.id;
    },
    onSuccess: (id) => {
      sessionIdRef.current = id;
      setRunning(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const finish = useMutation({
    mutationFn: async () => {
      const id = sessionIdRef.current;
      const spent = Math.max(1, Math.round((minutes * 60 - secondsLeft) / 60));
      if (!id) return;
      await finishFocusSession(id, { minutes: spent, notes: notes.trim() || null });
    },
    onSuccess: () => {
      sessionIdRef.current = null;
      setRunning(false);
      setSecondsLeft(minutes * 60);
      setNotes("");
      void qc.invalidateQueries({ queryKey: ["focus"] });
      toast.success("Session saved. Nicely done.");
    },
  });

  function pickLength(m: number) {
    setMinutes(m);
    setSecondsLeft(m * 60);
    setRunning(false);
  }

  const pct = Math.round(((minutes * 60 - secondsLeft) / (minutes * 60)) * 100);
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const totalMinutes = sessions.reduce((sum, s) => sum + s.minutes, 0);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <h1 className="font-display text-3xl font-bold">Focus mode</h1>
      <p className="mt-2 text-muted-foreground">
        One thing, one window. Notes stay right beside the timer.
      </p>

      <section className="panel-soft mt-6 p-7 text-center">
        <p className="font-display text-6xl font-bold tabular-nums">
          {mm}:{ss}
        </p>
        <Progress value={pct} className="mx-auto mt-5 h-2.5 max-w-sm rounded-full" />
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {LENGTHS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => pickLength(m)}
              className={`press rounded-2xl px-4 py-2 text-sm transition-colors ${
                minutes === m ? "bg-primary/20 ring-2 ring-primary/40" : "bg-muted/60"
              }`}
            >
              {m}m
            </button>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {!sessionIdRef.current ? (
            <Button onClick={() => start.mutate()} className="press gap-1.5 rounded-2xl px-6">
              <Play className="size-4" /> Start
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => setRunning((v) => !v)}
                className="press gap-1.5 rounded-2xl px-6"
              >
                {running ? <Pause className="size-4" /> : <Play className="size-4" />}
                {running ? "Pause" : "Resume"}
              </Button>
              <Button onClick={() => finish.mutate()} className="press gap-1.5 rounded-2xl px-6">
                <Timer className="size-4" /> Finish
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            onClick={() => pickLength(minutes)}
            className="press gap-1.5 rounded-2xl text-muted-foreground"
          >
            <RotateCcw className="size-4" /> Reset
          </Button>
        </div>
      </section>

      <section className="card-soft mt-5 space-y-3 p-6">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What are you focusing on?"
          className="rounded-2xl"
        />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Resource link (optional)"
          className="rounded-2xl"
        />
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-sm underline underline-offset-4"
          >
            Open resource in a new tab
          </a>
        )}
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes while you work…"
          className="min-h-40 rounded-2xl"
        />
      </section>

      <section className="mt-6">
        <h2 className="font-display text-lg font-semibold">
          Recent sessions{" "}
          <span className="text-sm font-normal text-muted-foreground">
            · {totalMinutes} minutes total
          </span>
        </h2>
        <ul className="mt-3 space-y-2">
          {sessions.slice(0, 6).map((session) => (
            <li key={session.id} className="card-soft flex items-center gap-3 px-4 py-3">
              <Timer className="size-4 text-primary" />
              <span className="min-w-0 flex-1 truncate text-sm">{session.title}</span>
              <span className="text-xs text-muted-foreground">{session.minutes} min</span>
            </li>
          ))}
          {sessions.length === 0 && (
            <li className="text-sm text-muted-foreground">No sessions logged yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
