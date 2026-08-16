import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Target, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  createGoal,
  createMilestone,
  deleteGoal,
  fetchGoals,
  fetchMilestones,
  updateGoal,
  updateMilestone,
  type Milestone,
} from "@/lib/db";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({
    meta: [
      { title: "Goals — Remispace" },
      {
        name: "description",
        content: "Bigger intentions, broken into milestones you can actually see.",
      },
      { property: "og:title", content: "Goals — Remispace" },
      { property: "og:description", content: "Track goals and milestones in Remispace." },
    ],
  }),
  component: GoalsPage,
});

/** Turns a target date into a friendly "3 days left" style countdown. */
function countdownLabel(date: string): string {
  const days = Math.ceil((new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86400000);
  if (days > 1) return `${days} days left`;
  if (days === 1) return "1 day left";
  if (days === 0) return "due today";
  return `${Math.abs(days)} days overdue`;
}

function GoalsPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const { data: goals = [] } = useQuery({ queryKey: ["goals"], queryFn: fetchGoals });
  const { data: milestones = [] } = useQuery({
    queryKey: ["milestones"],
    queryFn: fetchMilestones,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["goals"] });
    void qc.invalidateQueries({ queryKey: ["milestones"] });
  };

  const add = useMutation({
    mutationFn: () =>
      createGoal({
        title: title.trim(),
        description: description.trim() || null,
        target_date: targetDate || null,
      }),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setTargetDate("");
      refresh();
    },
  });
  const remove = useMutation({ mutationFn: deleteGoal, onSuccess: refresh });

  const activeGoals = goals.filter((g) => g.progress < 100);
  const avgProgress = goals.length
    ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length)
    : 0;
  const stepsDone = milestones.filter((m) => m.done).length;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <h1 className="font-display text-3xl font-bold">Goals</h1>
      <p className="mt-2 text-muted-foreground">
        Set ambitious long-term goals and let Remi decompose them into concrete, measurable milestones with progress tracking.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: "In progress", value: String(activeGoals.length) },
          { label: "Average progress", value: `${avgProgress}%` },
          {
            label: "Milestones done",
            value: `${stepsDone}/${milestones.length}`,
          },
        ].map((stat) => (
          <div key={stat.label} className="card-soft px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>

      <form
        className="card-soft mt-6 space-y-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) add.mutate();
        }}
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="A goal you care about…"
          className="rounded-2xl"
        />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Why does it matter? (optional)"
          className="min-h-20 rounded-2xl"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-44 rounded-2xl"
          />
          <Button type="submit" className="press gap-1.5 rounded-2xl">
            <Plus className="size-4" /> Add goal
          </Button>
        </div>
      </form>

      <div className="mt-7 space-y-4">
        {goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            milestones={milestones.filter((m) => m.goal_id === goal.id)}
            onDelete={() => remove.mutate(goal.id)}
            onRefresh={refresh}
          />
        ))}
        {goals.length === 0 && (
          <p className="rounded-3xl bg-muted/50 px-5 py-10 text-center text-sm text-muted-foreground">
            No goals yet. One is plenty to start.
          </p>
        )}
      </div>
    </div>
  );
}

function GoalCard({
  goal,
  milestones,
  onDelete,
  onRefresh,
}: {
  goal: {
    id: string;
    title: string;
    description: string | null;
    progress: number;
    target_date: string | null;
  };
  milestones: Milestone[];
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const [step, setStep] = useState("");

  const addStep = useMutation({
    mutationFn: () =>
      createMilestone({ goal_id: goal.id, title: step.trim(), position: milestones.length }),
    onSuccess: () => {
      setStep("");
      onRefresh();
    },
  });

  const toggleStep = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      await updateMilestone(id, { done });
      const total = milestones.length;
      const completed = milestones.filter((m) => (m.id === id ? done : m.done)).length;
      const progress = total ? Math.round((completed / total) * 100) : 0;
      await updateGoal(goal.id, { progress, status: progress === 100 ? "done" : "active" });
    },
    onSuccess: onRefresh,
  });

  return (
    <article className="card-soft p-6">
      <div className="flex items-start gap-3">
        <Target className="mt-0.5 size-5 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold">{goal.title}</h2>
          {goal.description && (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{goal.description}</p>
          )}
          {goal.target_date && (
            <p className="mt-1 text-xs text-muted-foreground">
              By {goal.target_date} · {countdownLabel(goal.target_date)}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete goal"
          onClick={onDelete}
          className="rounded-xl text-muted-foreground"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Progress value={goal.progress} className="h-2.5 rounded-full" />
        <span className="text-xs font-medium text-muted-foreground">{goal.progress}%</span>
      </div>

      <ul className="mt-4 space-y-1.5">
        {milestones.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-3 rounded-2xl px-2 py-1.5 hover:bg-muted/50"
          >
            <Checkbox
              checked={m.done}
              onCheckedChange={(v) => toggleStep.mutate({ id: m.id, done: Boolean(v) })}
              className="rounded-md"
            />
            <span className={`text-sm ${m.done ? "text-muted-foreground line-through" : ""}`}>
              {m.title}
            </span>
          </li>
        ))}
      </ul>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (step.trim()) addStep.mutate();
        }}
      >
        <Input
          value={step}
          onChange={(e) => setStep(e.target.value)}
          placeholder="Add a milestone…"
          className="rounded-2xl"
        />
        <Button type="submit" variant="secondary" size="icon" className="press rounded-2xl">
          <Plus className="size-4" />
        </Button>
      </form>
    </article>
  );
}
