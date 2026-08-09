import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Brain, Check, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { MessageResponse } from "@/components/ai-elements/message";
import { fetchDueFlashcards, fetchFlashcardsForItem, reviewFlashcard } from "@/lib/srs.functions";

type Card = Awaited<ReturnType<typeof fetchDueFlashcards>>[number];

const QUALITY_MAP = [
  { label: "Again", quality: 0, variant: "destructive" as const, description: "Forgot completely" },
  { label: "Hard", quality: 3, variant: "outline" as const, description: "Took effort" },
  {
    label: "Good",
    quality: 4,
    variant: "secondary" as const,
    description: "Recalled after thought",
  },
  { label: "Easy", quality: 5, variant: "default" as const, description: "Knew it instantly" },
];

export function FlashcardReview({
  itemId,
  onComplete,
}: {
  itemId?: string;
  onComplete?: () => void;
}) {
  const qc = useQueryClient();
  const runFetchDue = useServerFn(fetchDueFlashcards);
  const runFetchItemCards = useServerFn(fetchFlashcardsForItem);
  const runReview = useServerFn(reviewFlashcard);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: itemId ? ["flashcards-item", itemId] : ["due-flashcards"],
    queryFn: () => (itemId ? runFetchItemCards({ data: { itemId } }) : runFetchDue()),
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  const card: Card | undefined = cards[currentIndex];
  const remaining = cards.length - currentIndex;

  const review = useMutation({
    mutationFn: (quality: number) => {
      if (!card) throw new Error("No card");
      return runReview({ data: { cardId: card.id, quality } });
    },
    onSuccess: () => {
      setReviewed((r) => r + 1);
      setFlipped(false);
      if (currentIndex + 1 < cards.length) {
        setCurrentIndex((i) => i + 1);
      } else {
        void qc.invalidateQueries({ queryKey: ["due-flashcards"] });
        void qc.invalidateQueries({ queryKey: ["due-flashcard-count"] });
        if (itemId) {
          void qc.invalidateQueries({ queryKey: ["flashcards-item", itemId] });
        }
      }
    },
  });

  const flip = useCallback(() => setFlipped((f) => !f), []);

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        flip();
      }
      if (flipped) {
        const num = Number(e.key);
        if (num >= 1 && num <= 4) {
          e.preventDefault();
          const target = QUALITY_MAP[num - 1];
          if (target) review.mutate(target.quality);
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flip, flipped, review]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Sparkles className="size-5 animate-pulse text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading cards…</span>
      </div>
    );
  }

  // All done state
  if (!card || currentIndex >= cards.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-primary/10 p-4">
          <Check className="size-8 text-primary" />
        </div>
        <h3 className="mt-4 font-display text-lg font-semibold">
          {reviewed > 0 ? "All caught up!" : "No cards available"}
        </h3>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          {reviewed > 0
            ? `You reviewed ${reviewed} card${reviewed === 1 ? "" : "s"}. Nice work — your memory is getting stronger.`
            : "No flashcards generated for this topic yet."}
        </p>
        {onComplete && (
          <Button className="press mt-4 rounded-2xl" onClick={onComplete}>
            Done
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* Progress */}
      <div className="mb-4 flex w-full items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Brain className="size-3.5 text-primary" />
          {remaining} card{remaining === 1 ? "" : "s"} remaining
        </span>
        <span>{reviewed} reviewed</span>
      </div>

      {/* Card */}
      <button
        type="button"
        onClick={flip}
        className={`card-soft w-full min-h-[220px] cursor-pointer select-none rounded-3xl p-6 text-left transition-all hover:shadow-md ${flipped ? "bg-primary/5 border-primary/20" : ""}`}
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
          {flipped ? "Answer" : "Question"}
        </p>
        <div className="text-sm leading-relaxed">
          <MessageResponse>{flipped ? card.back : card.front}</MessageResponse>
        </div>
        {!flipped && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Tap to reveal · <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px]">Space</kbd>
          </p>
        )}
      </button>

      {/* Rating buttons (visible when flipped) */}
      {flipped && (
        <div className="mt-4 flex w-full flex-wrap gap-2">
          {QUALITY_MAP.map((q, i) => (
            <Button
              key={q.label}
              variant={q.variant}
              size="sm"
              className="press flex-1 gap-1 rounded-2xl"
              onClick={() => review.mutate(q.quality)}
              disabled={review.isPending}
            >
              <span className="text-[10px] text-muted-foreground">{i + 1}</span>
              {q.label}
            </Button>
          ))}
        </div>
      )}

      {flipped && (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Press <kbd className="rounded bg-muted px-1 py-0.5">1</kbd>-
          <kbd className="rounded bg-muted px-1 py-0.5">4</kbd> to rate
        </p>
      )}
    </div>
  );
}
