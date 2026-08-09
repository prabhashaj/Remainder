import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Flag, Plus, Timer, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { useFocusTimer } from "@/components/focus-timer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createTask, deleteTask, fetchTasks, today, updateTask, type Task } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Remainder" },
      {
        name: "description",
        content:
          "Everything on your plate, sorted gently by when it matters and how much it counts.",
      },
      { property: "og:title", content: "Tasks — Remainder" },
      { property: "og:description", content: "Your Remainder task list." },
    ],
  }),
  component: TasksPage,
});

type Filter = "today" | "upcoming" | "all" | "done";
const PRIORITIES = ["low", "medium", "high"] as const;

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-primary/10 text-primary",
  low: "bg-muted text-muted-foreground",
};

function TasksPage() {
  const qc = useQueryClient();
  const { start: startTimer } = useFocusTimer();
  const [filter, setFilter] = useState<Filter>("today");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(today());
  const [priority, setPriority] = useState<string>("medium");

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["tasks"] });

  const add = useMutation({
    mutationFn: () => createTask({ title: title.trim(), due_date: due || null, priority }),
    onSuccess: () => {
      setTitle("");
      refresh();
    },
  });
  const patch = useMutation({
    mutationFn: ({ id, ...rest }: { id: string } & Partial<Task>) => updateTask(id, rest),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: deleteTask, onSuccess: refresh });

  const day = today();
  const visible = useMemo(() => {
    const rank = { high: 0, medium: 1, low: 2 } as Record<string, number>;
    return tasks
      .filter((t) => {
        if (filter === "done") return t.done;
        if (t.done) return false;
        if (filter === "today") return !t.due_date || t.due_date <= day;
        if (filter === "upcoming") return t.due_date && t.due_date > day;
        return true;
      })
      .sort((a, b) => {
        const ra = rank[a.priority] ?? 1;
        const rb = rank[b.priority] ?? 1;
        if (ra !== rb) return ra - rb;
        return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
      });
  }, [tasks, filter, day]);

  const openToday = tasks.filter((t) => !t.done && (!t.due_date || t.due_date <= day)).length;
  const doneToday = tasks.filter((t) => t.done && t.due_date === day).length;
  const overdue = tasks.filter((t) => !t.done && t.due_date && t.due_date < day).length;
  const totalToday = openToday + doneToday;
  const pct = totalToday ? Math.round((doneToday / totalToday) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <h1 className="font-display text-3xl font-bold">Tasks</h1>
      <p className="mt-2 text-muted-foreground">Small steps, kept somewhere safe.</p>

      <div className="card-soft mt-6 px-5 py-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Today's progress</span>
          <span className="tabular-nums text-muted-foreground">
            {doneToday}/{totalToday || 0} done
            {overdue > 0 && ` · ${overdue} overdue`}
          </span>
        </div>
        <Progress value={pct} className="mt-3 h-2 rounded-full" />
      </div>

      <form
        className="mt-5 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) add.mutate();
        }}
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          className="min-w-48 flex-1 rounded-2xl"
        />
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-32 rounded-2xl" aria-label="Priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-2xl">
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="w-40 rounded-2xl"
        />
        <Button type="submit" className="press gap-1.5 rounded-2xl">
          <Plus className="size-4" /> Add
        </Button>
      </form>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mt-6">
        <TabsList className="rounded-2xl">
          <TabsTrigger value="today" className="rounded-xl">
            Today
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="rounded-xl">
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="all" className="rounded-xl">
            All open
          </TabsTrigger>
          <TabsTrigger value="done" className="rounded-xl">
            Done
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <ul className="mt-5 space-y-2">
        {visible.map((task) => {
          const isOverdue = !task.done && task.due_date && task.due_date < day;
          return (
            <li key={task.id} className="card-soft group flex items-start gap-3 px-4 py-3.5">
              <Checkbox
                checked={task.done}
                onCheckedChange={(v) =>
                  patch.mutate({
                    id: task.id,
                    done: Boolean(v),
                    status: v ? "done" : "todo",
                  })
                }
                className="mt-0.5 rounded-md"
              />
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${task.done ? "text-muted-foreground line-through" : ""}`}>
                  {task.title}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium capitalize ${
                      PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES["low"]
                    }`}
                  >
                    <Flag className="size-3" />
                    {task.priority}
                  </span>
                  {task.due_date && (
                    <span
                      className={`inline-flex items-center gap-1 ${
                        isOverdue ? "font-medium text-destructive" : ""
                      }`}
                    >
                      <CalendarDays className="size-3" />
                      {task.due_date}
                      {isOverdue && " · overdue"}
                    </span>
                  )}
                  {task.source === "remi" && <span>added by Remi</span>}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => startTimer(25, task.title)}
                aria-label="Focus on this task"
                className="rounded-xl text-muted-foreground"
              >
                <Timer className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => remove.mutate(task.id)}
                aria-label="Delete task"
                className="rounded-xl text-muted-foreground"
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="rounded-3xl bg-muted/50 px-5 py-10 text-center text-sm text-muted-foreground">
            Nothing here. That's allowed.
          </li>
        )}
      </ul>
    </div>
  );
}
