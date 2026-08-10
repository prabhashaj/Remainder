import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Moon, Sun, Trash2, Type } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useTheme } from "@/components/theme-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { clearMemories, fetchMemories, fetchProfile, updateProfile } from "@/lib/db";
import { THEMES, type ThemeId } from "@/lib/themes";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings & themes — Remainder" },
      {
        name: "description",
        content: "Choose your pastel theme, dark mode, name and reminder preferences.",
      },
      { property: "og:title", content: "Settings & themes — Remainder" },
      { property: "og:description", content: "Personalize your Remainder workspace." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { theme, font, setTheme, setFont, previewTheme, previewFont } = useTheme();
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: fetchProfile });
  const [name, setName] = useState("");

  useEffect(() => setName(profile?.display_name ?? ""), [profile?.display_name]);

  const save = useMutation({
    mutationFn: (patch: Parameters<typeof updateProfile>[0]) => updateProfile(patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Saved.");
    },
  });

  const { data: memories = [] } = useQuery({ queryKey: ["memories"], queryFn: fetchMemories });

  const resetMemories = useMutation({
    mutationFn: clearMemories,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["memories"] });
      toast.success("Agent's memory has been reset.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to reset memory."),
  });

  const lightThemes = THEMES.filter((t) => !t.isDark);
  const darkThemes = THEMES.filter((t) => t.isDark);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Settings</h1>
        <p className="mt-2 text-muted-foreground">Make Remainder feel like yours.</p>
      </div>

      <section className="card-soft p-6">
        <h2 className="font-display text-lg font-semibold">Your name</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What should Remi call you?"
            className="min-w-48 flex-1 rounded-2xl"
          />
          <Button
            onClick={() => save.mutate({ display_name: name.trim() || null })}
            className="press rounded-2xl"
          >
            Save
          </Button>
        </div>
      </section>

      {/* Light Themes */}
      <section className="card-soft p-6">
        <div className="flex items-center gap-2">
          <Sun className="size-5 text-amber-500" />
          <h2 className="font-display text-lg font-semibold">Soft Light Palettes</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Hover to preview, click to keep. Soft pastel workspace themes.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {lightThemes.map((t) => (
            <button
              key={t.id}
              type="button"
              onMouseEnter={() => previewTheme(t.id as ThemeId)}
              onMouseLeave={() => previewTheme(theme)}
              onClick={() => setTheme(t.id as ThemeId)}
              className={`press relative overflow-hidden rounded-3xl border p-3 text-left transition-shadow ${
                theme === t.id
                  ? "border-primary/50 shadow-soft ring-2 ring-primary/20"
                  : "border-border"
              }`}
            >
              <span className="flex gap-1.5">
                {t.swatches.map((color) => (
                  <span
                    key={color}
                    className="size-5 rounded-full border border-border/50"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </span>
              <span className="mt-2.5 block text-sm font-medium">{t.name}</span>
              {theme === t.id && (
                <Check className="absolute right-3 top-3 size-4 text-primary" aria-hidden />
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Dark Themes */}
      <section className="card-soft p-6">
        <div className="flex items-center gap-2">
          <Moon className="size-5 text-indigo-400" />
          <h2 className="font-display text-lg font-semibold">Rich Dark Palettes</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Deep, immersive dark modes with luminous neon-pastel accents.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {darkThemes.map((t) => (
            <button
              key={t.id}
              type="button"
              onMouseEnter={() => previewTheme(t.id as ThemeId)}
              onMouseLeave={() => previewTheme(theme)}
              onClick={() => setTheme(t.id as ThemeId)}
              className={`press relative overflow-hidden rounded-3xl border p-4 text-left transition-shadow ${
                theme === t.id
                  ? "border-primary/50 shadow-soft ring-2 ring-primary/20"
                  : "border-border"
              }`}
            >
              <span className="flex gap-2">
                {t.swatches.map((color) => (
                  <span
                    key={color}
                    className="size-6 rounded-full border border-white/20"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </span>
              <span className="mt-3 block font-display text-base font-semibold">{t.name}</span>
              <span className="text-xs text-muted-foreground block mt-0.5">{t.blurb}</span>
              {theme === t.id && (
                <Check className="absolute right-4 top-4 size-4 text-primary" aria-hidden />
              )}
            </button>
          ))}
        </div>
    </section>

      {/* Typography */}
      <section className="card-soft p-6">
        <div className="flex items-center gap-2">
          <Type className="size-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Typography</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a text style for your workspace.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            type="button"
            onMouseEnter={() => previewFont("sans")}
            onMouseLeave={() => previewFont(font)}
            onClick={() => setFont("sans")}
            className={`press relative rounded-3xl border p-4 text-left transition-shadow ${
              font === "sans"
                ? "border-primary/50 shadow-soft ring-2 ring-primary/20"
                : "border-border"
            }`}
          >
            <span className="block font-sans text-lg font-medium">Default (Sans)</span>
            <span className="text-xs text-muted-foreground block mt-0.5">Clean and modern.</span>
            {font === "sans" && (
              <Check className="absolute right-4 top-4 size-4 text-primary" aria-hidden />
            )}
          </button>

          <button
            type="button"
            onMouseEnter={() => previewFont("serif")}
            onMouseLeave={() => previewFont(font)}
            onClick={() => setFont("serif")}
            className={`press relative rounded-3xl border p-4 text-left transition-shadow ${
              font === "serif"
                ? "border-primary/50 shadow-soft ring-2 ring-primary/20"
                : "border-border"
            }`}
          >
            <span className="block font-serif text-lg font-medium">Serif</span>
            <span className="text-xs text-muted-foreground block mt-0.5">Elegant and classic.</span>
            {font === "serif" && (
              <Check className="absolute right-4 top-4 size-4 text-primary" aria-hidden />
            )}
          </button>

          <button
            type="button"
            onMouseEnter={() => previewFont("merienda")}
            onMouseLeave={() => previewFont(font)}
            onClick={() => setFont("merienda")}
            className={`press relative rounded-3xl border p-4 text-left transition-shadow ${
              font === "merienda"
                ? "border-primary/50 shadow-soft ring-2 ring-primary/20"
                : "border-border"
            }`}
          >
            <span className="block font-merienda text-2xl font-medium leading-none">Merienda</span>
            <span className="text-xs text-muted-foreground block mt-2">Soft, friendly and flowing.</span>
            {font === "merienda" && (
              <Check className="absolute right-4 top-4 size-4 text-primary" aria-hidden />
            )}
          </button>
        </div>
      </section>

      {/* Remi's Memory */}
      <section className="card-soft p-6">
        <div>
          <h2 className="font-display text-lg font-semibold">Remi's Memory</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Remi learns durable facts, preferences, and context as you converse. You can reset or
          clear this saved memory at any time.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <span className="text-sm font-medium text-foreground">
            Saved memories ({memories.length})
          </span>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="press gap-2 rounded-2xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" /> Reset Remi's Memory
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Remi's Memory?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently erase all facts, preferences, and durable memories Remi has
                  saved about you. Remi will start fresh in future conversations.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-2xl">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => resetMemories.mutate()}
                  disabled={resetMemories.isPending}
                  className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {resetMemories.isPending ? "Erasing…" : "Reset Memory"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>

      <section className="card-soft p-6">
        <h2 className="font-display text-lg font-semibold">Nudges</h2>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="daily" className="font-normal">
              Daily check-in reminder
            </Label>
            <Switch
              id="daily"
              checked={profile?.notify_daily ?? true}
              onCheckedChange={(v) => save.mutate({ notify_daily: v })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="celebrate" className="font-normal">
              Celebrate streaks and finished goals
            </Label>
            <Switch
              id="celebrate"
              checked={profile?.notify_celebrations ?? true}
              onCheckedChange={(v) => save.mutate({ notify_celebrations: v })}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
