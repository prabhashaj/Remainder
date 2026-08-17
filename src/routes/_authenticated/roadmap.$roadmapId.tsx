import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Flame,
  ListPlus,
  Search,
  Sparkle,
} from "lucide-react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  checkAndRecordRoadmapCompletion,
  createTask,
  dayOffset,
  fetchRoadmap,
  fetchRoadmapItems,
  fetchRoadmapStreakInfo,
  fetchTasks,
  today,
  updateRoadmapItem,
  type RoadmapItem,
} from "@/lib/db";

export const Route = createFileRoute("/_authenticated/roadmap/$roadmapId")({
  head: () => ({
    meta: [
      { title: "Learning roadmap — Remispace" },
      {
        name: "description",
        content:
          "A detailed learning roadmap with phases, topics, sub-topic lessons, images and videos.",
      },
      { property: "og:title", content: "Learning roadmap — Remispace" },
      {
        property: "og:description",
        content: "Phases, topics and full lessons for every sub-topic.",
      },
    ],
  }),
  component: RoadmapDetail,
});

const LAST_7_DAYS = Array.from({ length: 7 }, (_, i) => dayOffset(-6 + i));

function RoadmapDetail() {
  const { roadmapId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: roadmap } = useQuery({
    queryKey: ["roadmap", roadmapId],
    queryFn: () => fetchRoadmap(roadmapId),
  });
  const { data: items = [] } = useQuery({
    queryKey: ["roadmap-items", roadmapId],
    queryFn: () => fetchRoadmapItems(roadmapId),
  });

  const { data: streakInfo } = useQuery({
    queryKey: ["roadmap-streak", roadmapId],
    queryFn: () => fetchRoadmapStreakInfo(roadmapId),
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
  });

  const toggle = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const updated = await updateRoadmapItem(id, { done });
      if (done && roadmapId) {
        const newlyMastered = await checkAndRecordRoadmapCompletion(roadmapId);
        if (newlyMastered) {
          toast.success(
            `🎉 Skill Mastered! Remi saved "${roadmap?.topic ?? "this roadmap"}" as a completed skill in your memory!`,
            {
              duration: 6000,
            },
          );
        }
      }
      return updated;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["roadmap-items", roadmapId] });
      void qc.invalidateQueries({ queryKey: ["roadmap-streak", roadmapId] });
      void qc.invalidateQueries({ queryKey: ["roadmap-streak-overall"] });
    },
  });

  const addTask = useMutation({
    mutationFn: async (lessonTitle: string) => {
      return createTask({
        title: `Study: ${lessonTitle}`,
        due_date: today(),
      });
    },
    onSuccess: (newTask) => {
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(`Added "${newTask.title}" to today's tasks!`, {
        action: {
          label: "View Tasks",
          onClick: () => navigate({ to: "/tasks" }),
        },
      });
    },
  });

  const isTaskScheduled = (title: string) => {
    return tasks.some(
      (t) =>
        (t.title.toLowerCase() === `study: ${title}`.toLowerCase() ||
          t.title.toLowerCase() === title.toLowerCase()) &&
        !t.done,
    );
  };

  const topics = items.filter((i) => !i.parent_id);
  const subsFor = (id: string) => items.filter((i) => i.parent_id === id);

  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  const phases = topics.reduce<Record<string, RoadmapItem[]>>((acc, item) => {
    const list = acc[item.phase] ?? [];
    list.push(item);
    acc[item.phase] = list;
    return acc;
  }, {});

  const currentStreak = streakInfo?.currentStreak ?? 0;
  const todayActive = streakInfo?.todayActive ?? false;
  const activeDatesSet = new Set(streakInfo?.activeDates ?? []);

  return (
    <div className="mx-auto max-w-4xl px-5 pb-32 pt-8 sm:px-8 space-y-6">
      <Link
        to="/roadmaps"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All roadmaps
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-bold">{roadmap?.topic ?? "Roadmap"}</h1>
          {roadmap?.summary && (
            <p className="mt-2 leading-relaxed text-muted-foreground">{roadmap.summary}</p>
          )}
        </div>

        {/* Roadmap Streak Card */}
        <div className="card-soft flex items-center gap-3 px-4 py-3 border-primary/20 bg-primary/5 shrink-0">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Flame className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-base">
                {currentStreak} Day{currentStreak === 1 ? "" : "s"}
              </span>
              <span className="text-xs text-muted-foreground">streak</span>
            </div>
            {/* 7-day mini activity dots */}
            <div className="mt-1 flex items-center gap-1">
              {LAST_7_DAYS.map((d) => {
                const isActive = activeDatesSet.has(d);
                const isToday = d === today();
                return (
                  <span
                    key={d}
                    title={`${d}: ${isActive ? "Active" : "Inactive"}`}
                    className={`size-2 rounded-full transition-colors ${
                      isActive
                        ? "bg-primary"
                        : isToday
                          ? "border border-primary/60 bg-transparent"
                          : "bg-muted-foreground/30"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="card-soft p-4 space-y-3">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>Roadmap Progress</span>
          <span>
            {done}/{items.length} completed ({pct}%)
          </span>
        </div>
        <Progress value={pct} className="h-2.5 rounded-full" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
          {!todayActive ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚡ Keep your {roadmap?.topic ?? "roadmap"} streak alive: Complete a lesson or checkpoint today!
            </p>
          ) : (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              ✓ Learning streak active today! Keep building momentum.
            </p>
          )}

          {items.find((i) => !i.done) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const next = items.find((i) => !i.done);
                if (next) addTask.mutate(next.title);
              }}
              disabled={
                addTask.isPending ||
                Boolean(items.find((i) => !i.done && isTaskScheduled(i.title)))
              }
              className="rounded-2xl text-xs gap-1.5 press self-start sm:self-auto shrink-0"
            >
              <ListPlus className="size-3.5" />
              {items.find((i) => !i.done && isTaskScheduled(i.title))
                ? "Next Lesson In Tasks"
                : "Add Next Lesson to Tasks"}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-8">
        {Object.entries(phases).map(([phase, phaseTopics]) => (
          <section key={phase}>
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-primary">
              {phase}
            </h2>
            <div className="mt-3 space-y-4">
              {phaseTopics.map((topic) => (
                <article key={topic.id} className="card-soft p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <Checkbox
                        checked={topic.done}
                        onCheckedChange={(v) => toggle.mutate({ id: topic.id, done: Boolean(v) })}
                        className="mt-1 rounded-md"
                      />
                      <div className="min-w-0 flex-1">
                        <h3
                          className={`font-display text-base font-semibold ${topic.done ? "text-muted-foreground line-through" : ""}`}
                        >
                          {topic.title}
                        </h3>
                        {topic.detail && (
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            {topic.detail}
                          </p>
                        )}
                        {topic.estimated_minutes ? (
                          <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="size-3" />~{topic.estimated_minutes} min
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => addTask.mutate(topic.title)}
                      disabled={topic.done || isTaskScheduled(topic.title)}
                      className={`press rounded-xl text-xs gap-1 shrink-0 ${
                        isTaskScheduled(topic.title)
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title={isTaskScheduled(topic.title) ? "Added to tasks" : "Add to tasks"}
                    >
                      <ListPlus className="size-3.5" />
                      <span className="hidden sm:inline">
                        {isTaskScheduled(topic.title) ? "In tasks" : "Add to tasks"}
                      </span>
                    </Button>
                  </div>

                  <ul className="mt-3 space-y-1">
                    {subsFor(topic.id).map((sub) => (
                      <li key={sub.id}>
                        <div className="flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-muted/50">
                          <Checkbox
                            checked={sub.done}
                            onCheckedChange={(v) => toggle.mutate({ id: sub.id, done: Boolean(v) })}
                            className="mt-0.5 rounded-md"
                          />
                          <Link
                            to="/lesson/$itemId"
                            params={{ itemId: sub.id }}
                            className="min-w-0 flex-1"
                          >
                            <p
                              className={`text-sm font-medium ${sub.done ? "text-muted-foreground line-through" : ""}`}
                            >
                              {sub.title}
                            </p>
                            {sub.detail && (
                              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                                {sub.detail}
                              </p>
                            )}
                            <span className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
                              {sub.content ? "Read the lesson" : "Open lesson"}
                              <ChevronRight className="size-3" />
                            </span>
                          </Link>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              addTask.mutate(sub.title);
                            }}
                            disabled={sub.done || isTaskScheduled(sub.title)}
                            className={`press rounded-xl text-xs gap-1 shrink-0 ${
                              isTaskScheduled(sub.title)
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            title={isTaskScheduled(sub.title) ? "Added to tasks" : "Add to tasks"}
                          >
                            <ListPlus className="size-3.5" />
                            <span className="hidden sm:inline">
                              {isTaskScheduled(sub.title) ? "In tasks" : "Add to tasks"}
                            </span>
                          </Button>
                        </div>
                      </li>
                    ))}
                    {subsFor(topic.id).length === 0 && (
                      <li className="px-2 text-xs text-muted-foreground">
                        No sub-topics yet — ask Remi to expand this topic.
                      </li>
                    )}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>



      <div className="mt-8 flex flex-wrap gap-2">
        <Button asChild variant="outline" className="press gap-1.5 rounded-2xl">
          <Link
            to="/conversation"
            search={{
              seed: `Find the best current tutorials and videos for my ${roadmap?.topic ?? "roadmap"} roadmap`,
            }}
          >
            <Search className="size-4" /> Find tutorials
          </Link>
        </Button>
        <Button asChild variant="outline" className="press gap-1.5 rounded-2xl">
          <Link
            to="/conversation"
            search={{
              seed: `Add more advanced phases and sub-topics to my ${roadmap?.topic ?? "roadmap"} roadmap`,
            }}
          >
            <Sparkle className="size-4" /> Deepen this roadmap
          </Link>
        </Button>
      </div>
    </div>
  );
}
