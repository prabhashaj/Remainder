import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Compass,
  Layers,
  ListChecks,
  Plus,
  Sparkles,
  Target,
} from "lucide-react";
import { useState } from "react";

import { RemiPanel } from "@/components/remi-dock";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  createTask,
  fetchGoals,
  fetchRoadmapItems,
  fetchRoadmaps,
  fetchTasks,
  today,
  updateTask,
} from "@/lib/db";
import { fetchDueFlashcardCount } from "@/lib/srs.functions";
import { generateWeeklyReflection } from "@/lib/weekly.functions";
import { MessageResponse } from "@/components/ai-elements/message";
import { FlashcardReview } from "@/components/flashcard-review";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Today — Remispace" },
      { name: "description", content: "Your day at a glance: tasks and goal progress." },
      { property: "og:title", content: "Today — Remispace" },
      { property: "og:description", content: "Your day at a glance in Remispace." },
    ],
  }),
  component: Dashboard,
  errorComponent: () => (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-xl font-semibold">Something went wrong</p>
      <p className="text-sm text-muted-foreground max-w-xs">
        Remi ran into an issue loading your dashboard. Try refreshing the page.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="press rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        Refresh
      </button>
    </div>
  ),
});

function Dashboard() {
  const qc = useQueryClient();
  const day = today();
  const runFetchCardCount = useServerFn(fetchDueFlashcardCount);

  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });
  const { data: goals = [] } = useQuery({ queryKey: ["goals"], queryFn: fetchGoals });
  const { data: roadmaps = [] } = useQuery({ queryKey: ["roadmaps"], queryFn: fetchRoadmaps });
  const { data: roadmapItems = [] } = useQuery({
    queryKey: ["roadmap-items"],
    queryFn: () => fetchRoadmapItems(),
  });
  const { data: dueCardData } = useQuery({
    queryKey: ["due-flashcard-count"],
    queryFn: async () => {
      try {
        return await runFetchCardCount();
      } catch {
        return { count: 0 };
      }
    },
  });
  const { data: reflection, isLoading: reflectionLoading } = useQuery({
    queryKey: ["weekly-reflection"],
    queryFn: async () => {
      try {
        return await generateWeeklyReflection();
      } catch {
        return { text: "" };
      }
    },
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
  });

  const [newTask, setNewTask] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);

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

  const dueCardCount = dueCardData?.count ?? 0;

  // Next Best Action Determination
  const nextBestAction = (() => {
    // 1. Overdue task
    const overdueTask = tasks.find((t) => !t.done && t.due_date && t.due_date < day);
    if (overdueTask) {
      return {
        category: "Overdue task",
        title: overdueTask.title,
        actionText: "Complete task",
        link: "/tasks",
      };
    }

    // 2. Due Flashcards
    if (dueCardCount > 0) {
      return {
        category: "Spaced Repetition",
        title: `${dueCardCount} card${dueCardCount === 1 ? "" : "s"} ready for review`,
        actionText: "Review now",
        onClick: () => setReviewOpen(true),
      };
    }

    // 3. Undone Roadmap Lesson
    const unreadItem = roadmapItems.find((item) => !item.done && item.content_status === "ready");
    if (unreadItem) {
      return {
        category: "Roadmap Lesson",
        title: unreadItem.title,
        actionText: "Study lesson",
        link: `/lesson/${unreadItem.id}`,
      };
    }

    // 4. Any Undone Roadmap Lesson
    const anyUndoneItem = roadmapItems.find((item) => !item.done);
    if (anyUndoneItem) {
      return {
        category: "Roadmap Lesson",
        title: anyUndoneItem.title,
        actionText: "Open lesson",
        link: `/lesson/${anyUndoneItem.id}`,
      };
    }

    // 5. Fallback
    return {
      category: "All Clear",
      title: "Everything pressing is done. Take a breath or explore a roadmap.",
      actionText: "View Roadmaps",
      link: "/roadmaps",
    };
  })();

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-8 sm:py-8 space-y-5 sm:space-y-6 pb-28 sm:pb-12">
      {/* Pinned Next Best Action Card */}
      <section className="card-soft border-primary/30 bg-primary/8 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="rounded-2xl bg-primary/15 p-2.5 text-primary shrink-0">
              <Compass className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="inline-block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-primary">
                Next Best Action · {nextBestAction.category}
              </span>
              <h3 className="font-display text-base sm:text-lg font-semibold text-foreground mt-0.5 leading-snug">
                {nextBestAction.title}
              </h3>
            </div>
          </div>

          {nextBestAction.onClick ? (
            <Button
              onClick={nextBestAction.onClick}
              className="press rounded-2xl shrink-0 w-full sm:w-auto mt-1 sm:mt-0 font-bold"
            >
              {nextBestAction.actionText} <ArrowRight className="ml-1.5 size-4" />
            </Button>
          ) : (
            <Button asChild className="press rounded-2xl shrink-0 w-full sm:w-auto mt-1 sm:mt-0 font-bold">
              <Link to={nextBestAction.link ?? "#"}>
                {nextBestAction.actionText} <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
          )}
        </div>
      </section>

      {/* Remi Chat Panel */}
      <RemiPanel />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Today's List */}
        <section className="card-soft p-4 sm:p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListChecks className="size-4 sm:size-5 text-primary" />
              <h2 className="font-display text-base sm:text-lg font-semibold">Today's list</h2>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                {openTasks.length}
              </span>
            </div>
            <Button asChild variant="ghost" size="sm" className="rounded-xl text-xs sm:text-sm text-muted-foreground">
              <Link to="/tasks">
                All tasks <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newTask.trim()) addTask.mutate(newTask.trim());
            }}
          >
            <Input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Add a task for today…"
              className="h-11 sm:h-12 rounded-2xl text-sm"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!newTask.trim() || addTask.isPending}
              className="size-11 sm:size-12 shrink-0 press rounded-2xl"
              aria-label="Add task"
            >
              <Plus className="size-5" />
            </Button>
          </form>

          <ul className="space-y-1.5">
            {todaysTasks.slice(0, 8).map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-muted/60"
              >
                <Checkbox
                  checked={task.done}
                  onCheckedChange={(v) => toggleTask.mutate({ id: task.id, done: Boolean(v) })}
                  className="rounded-md size-5"
                />
                <span
                  className={`text-sm leading-relaxed min-w-0 flex-1 ${
                    task.done ? "text-muted-foreground line-through" : "text-foreground"
                  }`}
                >
                  {task.title}
                </span>
              </li>
            ))}
            {todaysTasks.length === 0 && (
              <li className="rounded-2xl bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
                ✨ Your list is clear. Add one small step to begin.
              </li>
            )}
          </ul>
        </section>

        {/* Goals in Motion */}
        <section className="card-soft p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="size-4 sm:size-5 text-primary" />
              <h2 className="font-display text-base sm:text-lg font-semibold">Goals in motion</h2>
            </div>
            <Button asChild variant="ghost" size="sm" className="rounded-xl text-xs sm:text-sm text-muted-foreground">
              <Link to="/goals">
                All goals <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
          <ul className="space-y-3.5">
            {goals.slice(0, 4).map((goal) => (
              <li key={goal.id} className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium">{goal.title}</span>
                  <span className="text-xs font-bold text-primary">{goal.progress}%</span>
                </div>
                <Progress value={goal.progress} className="mt-2 h-2 rounded-full" />
              </li>
            ))}
            {goals.length === 0 && (
              <li className="rounded-2xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
                No active goals yet. Ask Remi to shape one.
              </li>
            )}
          </ul>
        </section>

        {/* Weekly Reflection */}
        <section className="card-soft p-4 sm:p-6 lg:col-span-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <h2 className="font-display text-base sm:text-lg font-semibold">Your week, seen</h2>
          </div>
          {reflectionLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Remi is reviewing your week…
            </p>
          ) : reflection?.text ? (
            <div className="mt-3 text-sm leading-relaxed">
              <MessageResponse>{reflection.text}</MessageResponse>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Once you've logged a few study sessions, I'll show your learning rhythm here.
            </p>
          )}
        </section>
      </div>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-bold">
              Spaced Repetition Review
            </DialogTitle>
          </DialogHeader>
          <FlashcardReview onComplete={() => setReviewOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
