import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, Mail, MessageSquareHeart, Moon, Send, Sun, Trash2, Type } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  clearMemories,
  fetchMemories,
  fetchProfile,
  updateProfile,
  createMemory,
  deleteMemory,
} from "@/lib/db";
import { THEMES, FONTS, type ThemeId } from "@/lib/themes";
import { BillingSection } from "@/components/billing-section";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings & themes — Remispace" },
      {
        name: "description",
        content: "Choose your pastel theme, dark mode, name and reminder preferences.",
      },
      { property: "og:title", content: "Settings & themes — Remispace" },
      { property: "og:description", content: "Personalize your Remispace workspace." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { theme, font, setTheme, setFont, previewTheme, previewFont } = useTheme();
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: fetchProfile });
  const [name, setName] = useState("");
  const [newMemoryContent, setNewMemoryContent] = useState("");

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

  const addMemory = useMutation({
    mutationFn: (content: string) => createMemory(content),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["memories"] });
      setNewMemoryContent("");
      toast.success("Preference added.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add preference."),
  });

  const removeMemory = useMutation({
    mutationFn: (id: string) => deleteMemory(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["memories"] });
      toast.success("Memory removed.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to remove memory."),
  });

  const lightThemes = THEMES.filter((t) => !t.isDark);
  const darkThemes = THEMES.filter((t) => t.isDark);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Settings</h1>
        <p className="mt-2 text-muted-foreground">Make Remispace feel like yours.</p>
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
          Click to select your preferred soft pastel workspace theme.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {lightThemes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id as ThemeId)}
              className={`press relative overflow-hidden rounded-3xl border p-3 text-left transition-all ${
                theme === t.id
                  ? "border-primary shadow-soft ring-2 ring-primary/30"
                  : "border-border hover:border-border/80"
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
          Deep, immersive dark modes with luminous neon-pastel accents. Click to select.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {darkThemes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id as ThemeId)}
              className={`press relative overflow-hidden rounded-3xl border p-4 text-left transition-all ${
                theme === t.id
                  ? "border-primary shadow-soft ring-2 ring-primary/30"
                  : "border-border hover:border-border/80"
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
          <h2 className="font-display text-lg font-semibold">Iconic Typography</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Click to choose an iconic font aesthetic for your notes and workspace.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {FONTS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFont(f.id)}
              className={`press relative rounded-3xl border p-4 text-left transition-all ${
                font === f.id
                  ? "border-primary shadow-soft ring-2 ring-primary/30"
                  : "border-border hover:border-border/80"
              }`}
            >
              <span className={`block text-xl font-medium ${f.fontClass}`}>{f.name}</span>
              <span className="text-xs text-muted-foreground block mt-1">{f.blurb}</span>
              {font === f.id && (
                <Check className="absolute right-4 top-4 size-4 text-primary" aria-hidden />
              )}
            </button>
          ))}
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

        <div className="mt-5">
          <h3 className="text-sm font-medium text-foreground">
            Saved memories ({memories.length})
          </h3>

          {memories.length > 0 && (
            <ul className="mt-4 space-y-2">
              {memories.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-2xl border border-border/50 bg-background/50 px-4 py-3 shadow-sm"
                >
                  <div className="flex flex-col gap-1 pr-4 min-w-0">
                    {m.category && (
                      <span className="inline-flex w-fit items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary capitalize">
                        {m.category}
                      </span>
                    )}
                    <span className="text-sm text-foreground break-words">{m.content}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="press shrink-0 text-muted-foreground hover:text-destructive h-8 w-8 rounded-full p-0"
                    onClick={() => removeMemory.mutate(m.id)}
                    aria-label="Remove memory"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <form
            className="mt-4 flex flex-wrap gap-2 items-center"
            onSubmit={(e) => {
              e.preventDefault();
              if (newMemoryContent.trim()) {
                addMemory.mutate(newMemoryContent.trim());
              }
            }}
          >
            <Input
              value={newMemoryContent}
              onChange={(e) => setNewMemoryContent(e.target.value)}
              placeholder="Tell Remi a preference, ambition, or goal (e.g. 'I prefer concise answers')"
              className="min-w-48 flex-1 rounded-2xl"
            />
            <Button
              type="submit"
              disabled={!newMemoryContent.trim() || addMemory.isPending}
              className="press rounded-2xl"
            >
              Add Memory
            </Button>
          </form>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
          <span className="text-sm text-muted-foreground">
            Want to start fresh? This cannot be undone.
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

      <BillingSection />

      <FeedbackSection />

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

function FeedbackSection() {
  const [category, setCategory] = useState<"General Feedback" | "Feature Request" | "Bug Report" | "Question">("General Feedback");
  const [feedbackText, setFeedbackText] = useState("");
  const [copied, setCopied] = useState(false);

  const targetEmail = "ajprabhash@gmail.com";

  const subject = `Remispace Feedback [${category}]`;
  const body = feedbackText.trim()
    ? `${feedbackText.trim()}\n\n---\nCategory: ${category}\nSent from Remispace Settings`
    : `Hi Remispace team,\n\nI wanted to share some feedback regarding ${category}:\n\n`;

  const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const handleCopyEmail = () => {
    void navigator.clipboard.writeText(targetEmail);
    setCopied(true);
    toast.success("Email copied: " + targetEmail);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <section className="card-soft p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageSquareHeart className="size-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Feedback & Support</h2>
        </div>
        <button
          type="button"
          onClick={handleCopyEmail}
          className="press inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/15 transition-all cursor-pointer"
          title="Click to copy email address"
        >
          <Mail className="size-3.5" />
          <span>{targetEmail}</span>
        </button>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        Have an idea, found a bug, or want a new study tool? We would love to hear from you.
      </p>

      {/* Category Selection */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(["General Feedback", "Feature Request", "Bug Report", "Question"] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`press text-xs font-medium px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
              category === cat
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "border-border/60 bg-background/50 text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Feedback Message Input */}
      <div className="mt-4 space-y-3">
        <Textarea
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder="Share your thoughts, describe a feature you would love, or report any issues..."
          className="min-h-[100px] rounded-2xl border-border/60 bg-background/50 focus-visible:ring-primary text-sm resize-none"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Direct email:</span>
            <button
              type="button"
              onClick={handleCopyEmail}
              className="inline-flex items-center gap-1 font-mono text-xs text-foreground hover:text-primary transition-colors cursor-pointer rounded-md bg-muted/60 px-2 py-0.5"
            >
              {copied ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
              <span>{targetEmail}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const fullText = `To: ${targetEmail}\nSubject: ${subject}\n\n${body}`;
                void navigator.clipboard.writeText(fullText);
                toast.success("Copied message & recipient to clipboard!");
              }}
              className="press rounded-xl text-xs"
              title="Copy message and recipient to clipboard"
            >
              <Copy className="size-3.5 mr-1" />
              <span>Copy Message</span>
            </Button>
            <a
              href={gmailHref}
              target="_blank"
              rel="noopener noreferrer"
              className="press rounded-xl text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm inline-flex items-center justify-center px-4 py-2 transition-all"
              title="Open directly in Gmail web composer"
            >
              <Send className="size-3.5" />
              <span>Send via Gmail</span>
              <ExternalLink className="size-3 opacity-70" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
