import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, ChevronRight, Sparkle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import remiLogo from "@/assets/remi.png";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateProfile } from "@/lib/db";
import { THEMES, type ThemeId } from "@/lib/themes";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome to Remispace" },
      { name: "description", content: "A quick setup so Remi knows how to coach you." },
    ],
  }),
  component: Onboarding,
});

const STEPS = ["You", "Vibe", "Start"] as const;

function Onboarding() {
  const navigate = useNavigate();
  const { theme, setTheme, previewTheme } = useTheme();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");

  const finish = useMutation({
    mutationFn: () =>
      updateProfile({
        display_name: name.trim() || null,
        theme: theme as string,
        onboarded: true,
      }),
    onSuccess: () => {
      toast.success("You're all set. Welcome aboard.");
      if (topic.trim()) {
        navigate({
          to: "/conversation",
          search: { seed: `I want to learn ${topic.trim()}. Can you help me build a plan?` },
        });
      } else {
        navigate({ to: "/dashboard" });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-lg flex-col justify-center px-5 py-10">
      {/* Stepper */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex size-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="size-4" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-8 rounded-full ${i < step ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="card-soft p-8">
        {step === 0 && (
          <div>
            <img src={remiLogo} alt="Remi" width={64} height={64} className="mx-auto size-16" />
            <h1 className="mt-5 text-center font-display text-2xl font-bold">
              Welcome to Remispace
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
              I'm Remi, your learning coach. First — what should I call you?
            </p>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name or nickname"
              className="mt-6 rounded-2xl"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") setStep(1);
              }}
            />
            <Button
              onClick={() => setStep(1)}
              className="press mt-5 w-full gap-1.5 rounded-2xl"
              size="lg"
            >
              Continue <ChevronRight className="size-4" />
            </Button>
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="text-center font-display text-2xl font-bold">Pick your vibe</h1>
            <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
              Ten soft palettes. Hover to preview, click to keep. You can change this anytime in
              Settings.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onMouseEnter={() => previewTheme(t.id as ThemeId)}
                  onMouseLeave={() => previewTheme(theme)}
                  onClick={() => setTheme(t.id as ThemeId)}
                  className={`press relative overflow-hidden rounded-2xl border p-3 text-left transition-shadow ${
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
                  <span className="mt-2 block text-sm font-medium">{t.name}</span>
                  {theme === t.id && (
                    <Check className="absolute right-3 top-3 size-4 text-primary" aria-hidden />
                  )}
                </button>
              ))}
            </div>
            <Button
              onClick={() => setStep(2)}
              className="press mt-6 w-full gap-1.5 rounded-2xl"
              size="lg"
            >
              Continue <ChevronRight className="size-4" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div>
            <Sparkle className="mx-auto size-8 text-primary" />
            <h1 className="mt-4 text-center font-display text-2xl font-bold">
              What are you learning?
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
              Tell me something you'd like to learn or get better at, and I'll start you off with a
              plan. Totally optional.
            </p>
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. I want to learn Spanish, get into watercolor, or master machine learning…"
              className="mt-6 min-h-28 rounded-2xl"
              autoFocus
            />
            <div className="mt-5 flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                className="press flex-1 rounded-2xl text-muted-foreground"
              >
                Back
              </Button>
              <Button
                onClick={() => finish.mutate()}
                disabled={finish.isPending}
                className="press flex-[2] gap-1.5 rounded-2xl"
                size="lg"
              >
                {finish.isPending
                  ? "Setting up…"
                  : topic.trim()
                    ? "Let's go — talk to Remi"
                    : "Let's go"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
