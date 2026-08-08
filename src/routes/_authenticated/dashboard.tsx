import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarHeart, Plus } from "lucide-react";
import { useState } from "react";

import { RemiPanel } from "@/components/remi-dock";
import { Button } from "@/components/ui/button";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  createTask,
  fetchGoals,
  fetchProfile,
  fetchTasks,
  today,
  updateTask,
} from "@/lib/db";
import { generateWeeklyReflection } from "@/lib/weekly.functions";
import { MessageResponse } from "@/components/ai-elements/message";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Today — Remainder" },
      { name: "description", content: "Your day at a glance: tasks, mood and goal progress." },
      { property: "og:title", content: "Today — Remainder" },
      { property: "og:description", content: "Your day at a glance in Remainder." },
    ],
  }),
  component: Dashboard,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const qc = useQueryClient();
  const day = today();

  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: fetchProfile });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });
  const { data: goals = [] } = useQuery({ queryKey: ["goals"], queryFn: fetchGoals });
  const { data: reflection, isLoading: reflectionLoading } = useQuery({
    queryKey: ["weekly-reflection"],
    queryFn: () => generateWeeklyReflection(),
    staleTime: 6 * 60 * 60 * 1000,
  });

  const [newTask, setNewTask] = useState("");

  const invalidate = (keys: string[]) =>
    keys.forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));

  const toggleTask = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      updateTask(id, { done, status: done ? "done" : "todo" }),
    onSuccess: () => invalidate(["tasks"]),
  });

  const addTask = useMutation({
    mutationFn: (title: string) => createTask({ title, due_date: day }),
    onSuccess: () => {
      setNewTask("");
      invalidate(["tasks"]);
    },
  });

  const todaysTasks = tasks.filter((t) => !t.due_date || t.due_date <= day);
  const openTasks = todaysTasks.filter((t) => !t.done);
  const doneToday = todaysTasks.length - openTasks.length;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold">
          {greeting()}
          {profile?.display_name ? `, ${profile.display_name}` : ""}.
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {openTasks.length === 0
            ? "Nothing pressing today. A calm day counts too."
            : `${openTasks.length} thing${openTasks.length === 1 ? "" : "s"} waiting, ${doneToday} already done. One at a time.`}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <RemiPanel className="lg:col-span-3" />

        <section className="card-soft p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Today's list</h2>
            <Button asChild variant="ghost" size="sm" className="rounded-xl text-muted-foreground">
              <Link to="/tasks">
                All tasks <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newTask.trim()) addTask.mutate(newTask.trim());
            }}
          >
            <Input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Add something for today…"
              className="rounded-2xl"
            />
            <Button type="submit" size="icon" className="press rounded-2xl">
              <Plus className="size-4" />
            </Button>
          </form>

          <ul className="mt-4 space-y-1.5">
            {todaysTasks.slice(0, 8).map((task) => (
              <li
                key={task.id}
                className="flex items-start gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-muted/60"
              >
                <Checkbox
                  checked={task.done}
                  onCheckedChange={(v) => toggleTask.mutate({ id: task.id, done: Boolean(v) })}
                  className="mt-0.5 rounded-md"
                />
                <span
                  className={`text-sm leading-relaxed ${task.done ? "text-muted-foreground line-through" : ""}`}
                >
                  {task.title}
                </span>
              </li>
            ))}
            {todaysTasks.length === 0 && (
              <li className="rounded-2xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
                Your list is empty. Add one small step.
              </li>
            )}
          </ul>
        </section>

        <section className="card-soft p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Goals in motion</h2>
            <Button asChild variant="ghost" size="sm" className="rounded-xl text-muted-foreground">
              <Link to="/goals">
                All goals <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
          <ul className="mt-4 space-y-4">
            {goals.slice(0, 4).map((goal) => (
              <li key={goal.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium">{goal.title}</span>
                  <span className="text-xs text-muted-foreground">{goal.progress}%</span>
                </div>
                <Progress value={goal.progress} className="mt-2 h-2 rounded-full" />
              </li>
            ))}
            {goals.length === 0 && (
              <li className="text-sm text-muted-foreground">
                No goals yet. Ask Remi to help shape one.
              </li>
            )}
          </ul>
        </section>

        <section className="card-soft p-6 lg:col-span-3">
          <div className="flex items-center gap-2">
            <CalendarHeart className="size-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Your week, seen</h2>
          </div>
          {reflectionLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Remi is looking back over your week…
            </p>
          ) : reflection?.text ? (
            <div className="mt-3 text-sm leading-relaxed">
              <MessageResponse>{reflection.text}</MessageResponse>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Once you've logged a few days, I'll show you the pattern I'm noticing here.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
