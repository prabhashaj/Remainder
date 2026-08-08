import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { fetchProfile, updateProfile } from "@/lib/db";
import { THEMES, type ThemeId } from "@/lib/themes";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings & themes — Remainder" },
      { name: "description", content: "Choose your pastel theme, name and reminder preferences." },
      { property: "og:title", content: "Settings & themes — Remainder" },
      { property: "og:description", content: "Personalize your Remainder workspace." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { theme, setTheme, previewTheme } = useTheme();
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

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <h1 className="font-display text-3xl font-bold">Settings</h1>
      <p className="mt-2 text-muted-foreground">Make Remainder feel like yours.</p>

      <section className="card-soft mt-6 p-6">
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

      <section className="card-soft mt-5 p-6">
        <h2 className="font-display text-lg font-semibold">Theme</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Hover to preview, click to keep. Ten soft palettes.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onMouseEnter={() => previewTheme(t.id as ThemeId)}
              onMouseLeave={() => previewTheme(theme)}
              onClick={() => setTheme(t.id as ThemeId)}
              className={`press relative overflow-hidden rounded-3xl border p-3 text-left transition-shadow ${
                theme === t.id ? "border-primary/50 shadow-soft" : "border-border"
              }`}
            >
              <span className="flex gap-1.5">
                {t.swatches.map((color) => (
                  <span
                    key={color}
                    className="size-5 rounded-full"
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

      <section className="card-soft mt-5 p-6">
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
