import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Archive, Flame, Plus, TrendingUp } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  archiveHabit,
  createHabit,
  dayOffset,
  fetchHabitLogs,
  fetchHabits,
  streakFor,
  toggleHabit,
  today,
  type Habit,
  type HabitLog,
} from "@/lib/db";
import { ICON_KEYS, iconFor } from "@/lib/icons";

export const Route = createFileRoute("/_authenticated/habits")({
  head: () => ({
    meta: [
      { title: "Habits — Remispace" },
      {
        name: "description",
        content: "Weekly rhythms, streaks and consistency for the habits you're building.",
      },
      { property: "og:title", content: "Habits — Remispace" },
      {
        property: "og:description",
        content: "Track habits and weekly consistency in Remispace.",
      },
    ],
  }),
  component: HabitsPage,
});

const DAYS = Array.from({ length: 7 }, (_, i) => dayOffset(-6 + i));

function weekdayLabel(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
  });
}

function HabitsPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("sprout");
  const [target, setTarget] = useState(7);

  const { data: habits = [] } = useQuery({
    queryKey: ["habits"],
    queryFn: fetchHabits,
  });
  const { data: logs = [] } = useQuery({
    queryKey: ["habit-logs"],
    queryFn: () => fetchHabitLogs(dayOffset(-60)),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["habits"] });
    void qc.invalidateQueries({ queryKey: ["habit-logs"] });
  };

  const add = useMutation({
    mutationFn: () =>
      createHabit({
        title: title.trim(),
        icon,
        target_per_week: target,
      }),
    onSuccess: () => {
      setTitle("");
      refresh();
    },
  });
  const toggle = useMutation({
    mutationFn: ({ id, day, on }: { id: string; day: string; on: boolean }) =>
      toggleHabit(id, day, on),
    onSuccess: refresh,
  });
  const archive = useMutation({ mutationFn: archiveHabit, onSuccess: refresh });

  const doneToday = habits.filter((h) =>
    logs.some((l) => l.habit_id === h.id && l.day === today()),
  ).length;
  const weekLogs = logs.filter((l) => DAYS.includes(l.day)).length;
  const weekTarget = habits.reduce((sum, h) => sum + h.target_per_week, 0);
  const bestStreak = habits.reduce((best, h) => Math.max(best, streakFor(h.id, logs)), 0);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <h1 className="font-display text-3xl font-bold">Habits</h1>
      <p className="mt-2 text-muted-foreground">
        Missing a day is fine. Coming back is the whole trick.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Done today" value={`${doneToday}/${habits.length || 0}`} />
        <StatCard
          label="This week"
          value={weekTarget ? `${weekLogs}/${weekTarget}` : String(weekLogs)}
        />
        <StatCard label="Best streak" value={`${bestStreak} days`} />
      </div>

      <form
        className="card-soft mt-6 space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) add.mutate();
        }}
      >
        <div className="flex flex-wrap gap-1.5">
          {ICON_KEYS.map((key) => {
            const Icon = iconFor(key);
            return (
              <button
                key={key}
                type="button"
                aria-label={`Use ${key} icon`}
                aria-pressed={icon === key}
                onClick={() => setIcon(key)}
                className={`press flex size-10 items-center justify-center rounded-2xl transition-colors ${
                  icon === key
                    ? "bg-primary/15 text-primary ring-2 ring-primary/40"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="size-[18px]" />
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New habit…"
            className="min-w-44 flex-1 rounded-2xl"
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="whitespace-nowrap">Days / week</span>
            <Input
              type="number"
              min={1}
              max={7}
              value={target}
              onChange={(e) => setTarget(Math.min(7, Math.max(1, Number(e.target.value) || 1)))}
              className="w-20 rounded-2xl"
            />
          </label>
          <Button type="submit" className="press gap-1.5 rounded-2xl">
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </form>

      <div className="mt-7 space-y-3">
        {habits.map((habit) => (
          <HabitCard
            key={habit.id}
            habit={habit}
            logs={logs}
            onToggle={(day, on) => toggle.mutate({ id: habit.id, day, on })}
            onArchive={() => archive.mutate(habit.id)}
          />
        ))}
        {habits.length === 0 && (
          <p className="rounded-3xl bg-muted/50 px-5 py-10 text-center text-sm text-muted-foreground">
            Pick one small habit to begin with.
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-soft px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function HabitCard({
  habit,
  logs,
  onToggle,
  onArchive,
}: {
  habit: Habit;
  logs: HabitLog[];
  onToggle: (day: string, on: boolean) => void;
  onArchive: () => void;
}) {
  const Icon = iconFor(habit.icon);
  const streak = streakFor(habit.id, logs);
  const thisWeek = DAYS.filter((day) =>
    logs.some((l) => l.habit_id === habit.id && l.day === day),
  ).length;
  const pct = Math.min(100, Math.round((thisWeek / Math.max(1, habit.target_per_week)) * 100));

  return (
    <article className="card-soft p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-base font-semibold">{habit.title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {thisWeek} of {habit.target_per_week} days this week
          </p>
        </div>
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Flame className="size-4" /> {streak}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Archive habit"
          onClick={onArchive}
          className="rounded-xl text-muted-foreground"
        >
          <Archive className="size-4" />
        </Button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Progress value={pct} className="h-2 rounded-full" />
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <TrendingUp className="size-3.5" />
          {pct}%
        </span>
      </div>

      <div className="mt-4 flex gap-1.5">
        {DAYS.map((day) => {
          const on = logs.some((l) => l.habit_id === habit.id && l.day === day);
          return (
            <button
              key={day}
              type="button"
              aria-label={`${habit.title} on ${day}`}
              aria-pressed={on}
              onClick={() => onToggle(day, !on)}
              className={`press flex h-11 flex-1 flex-col items-center justify-center rounded-2xl text-[11px] transition-colors ${
                on
                  ? "bg-primary/25 font-semibold text-foreground"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {weekdayLabel(day)}
            </button>
          );
        })}
      </div>
    </article>
  );
}
