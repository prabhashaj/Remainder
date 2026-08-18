import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Brain,
  CheckCircle2,
  ChevronRight,
  PartyPopper,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MessageResponse } from "@/components/ai-elements/message";
import {
  fetchDueFlashcards,
  fetchFlashcardsForItem,
  generateFlashcardsForItem,
  reviewFlashcard,
} from "@/lib/srs.functions";

type Card = Awaited<ReturnType<typeof fetchDueFlashcards>>[number];

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
  const runGenerate = useServerFn(generateFlashcardsForItem);

  const { data: rawCards = [], isLoading } = useQuery({
    queryKey: itemId ? ["flashcards-item", itemId] : ["due-flashcards"],
    queryFn: () => (itemId ? runFetchItemCards({ data: { itemId } }) : runFetchDue()),
  });

  // Strictly limit to 5 cards in the session
  const cards = rawCards.slice(0, 5);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    mastered: 0,
    learning: 0,
    total: 0,
  });

  const card: Card | undefined = cards[currentIndex];
  const isFinished = !isLoading && cards.length > 0 && currentIndex >= cards.length;
  const progressPercent = cards.length > 0 ? Math.round((currentIndex / cards.length) * 100) : 0;

  const regenerate = useMutation({
    mutationFn: () => {
      if (!itemId) throw new Error("No item ID");
      return runGenerate({ data: { itemId } });
    },
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`Generated ${res.count ?? 5} fresh flashcards!`);
        void qc.invalidateQueries({ queryKey: ["flashcards-item", itemId] });
        void qc.invalidateQueries({ queryKey: ["flashcard-count-item", itemId] });
        void qc.invalidateQueries({ queryKey: ["due-flashcards"] });
        void qc.invalidateQueries({ queryKey: ["due-flashcard-count"] });
        setCurrentIndex(0);
        setFlipped(false);
        setSessionStats({ mastered: 0, learning: 0, total: 0 });
      } else {
        toast.error(res.error || "Failed to regenerate flashcards");
      }
    },
  });

  const review = useMutation({
    mutationFn: async ({ quality, isMastered }: { quality: number; isMastered: boolean }) => {
      if (!card) throw new Error("No card to review");
      return {
        res: await runReview({ data: { cardId: card.id, quality } }),
        isMastered,
      };
    },
    onSuccess: ({ isMastered }) => {
      setSessionStats((prev) => ({
        mastered: prev.mastered + (isMastered ? 1 : 0),
        learning: prev.learning + (isMastered ? 0 : 1),
        total: prev.total + 1,
      }));
      setFlipped(false);
      // Advance to next card or completion screen
      setCurrentIndex((prev) => prev + 1);

      // Invalidate queries so parent lists and counters refresh
      void qc.invalidateQueries({ queryKey: ["due-flashcards"] });
      void qc.invalidateQueries({ queryKey: ["due-flashcard-count"] });
      if (itemId) {
        void qc.invalidateQueries({ queryKey: ["flashcards-item", itemId] });
        void qc.invalidateQueries({ queryKey: ["flashcard-count-item", itemId] });
      }
    },
  });

  const flip = useCallback(() => {
    setFlipped((f) => !f);
  }, []);

  const handleReviewAction = useCallback(
    (action: "learning" | "got_it") => {
      if (review.isPending || !card) return;
      if (action === "learning") {
        review.mutate({ quality: 1, isMastered: false });
      } else {
        review.mutate({ quality: 5, isMastered: true });
      }
    },
    [review, card],
  );

  const handleRestartDeck = () => {
    setCurrentIndex(0);
    setFlipped(false);
    setSessionStats({ mastered: 0, learning: 0, total: 0 });
  };

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (!isFinished && card) {
          flip();
        }
      }

      if (flipped && !review.isPending && card) {
        if (e.key === "1" || e.key === "ArrowLeft") {
          e.preventDefault();
          handleReviewAction("learning");
        } else if (e.key === "2" || e.key === "ArrowRight") {
          e.preventDefault();
          handleReviewAction("got_it");
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flip, flipped, isFinished, card, review.isPending, handleReviewAction]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="size-6 animate-pulse" />
        </div>
        <p className="font-display font-medium text-sm text-foreground">Loading your flashcards…</p>
        <p className="text-xs text-muted-foreground">Preparing spaced repetition deck</p>
      </div>
    );
  }

  // Empty state: no cards exist
  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-3xl bg-muted text-muted-foreground">
          <Brain className="size-7" />
        </div>
        <h3 className="mt-4 font-display text-lg font-bold">No Cards Available</h3>
        <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">
          No flashcards have been created for this lesson yet. Generate the lesson content to build
          spaced-repetition cards.
        </p>
        {onComplete && (
          <Button className="press mt-6 rounded-2xl px-6" onClick={onComplete}>
            Close
          </Button>
        )}
      </div>
    );
  }

  // Completion state
  if (isFinished) {
    const accuracy =
      sessionStats.total > 0
        ? Math.round((sessionStats.mastered / sessionStats.total) * 100)
        : 100;

    return (
      <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="relative flex size-16 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
          <PartyPopper className="size-8" />
        </div>

        <h3 className="mt-4 font-display text-xl font-bold text-foreground">Session Complete!</h3>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          You finished all {cards.length} flashcards in this deck. Your progress is saved to your
          memory engine.
        </p>

        {/* Stats Grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 w-full max-w-xs">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-center">
            <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
              <span className="font-display text-lg font-bold">{sessionStats.mastered}</span>
            </div>
            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Got It</p>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-center">
            <div className="flex items-center justify-center gap-1.5 text-amber-600 dark:text-amber-400">
              <RotateCcw className="size-4" />
              <span className="font-display text-lg font-bold">{sessionStats.learning}</span>
            </div>
            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Still Learning</p>
          </div>
        </div>

        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Trophy className="size-3.5" />
          {accuracy}% Mastery Rate
        </div>

        <div className="mt-8 flex w-full max-w-sm items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="press flex-1 rounded-2xl gap-1 text-xs border-border/80"
            onClick={handleRestartDeck}
          >
            <RotateCcw className="size-3.5" /> Review Again
          </Button>
          {itemId && (
            <Button
              variant="outline"
              size="sm"
              className="press flex-1 rounded-2xl gap-1 text-xs border-border/80"
              onClick={() => regenerate.mutate()}
              disabled={regenerate.isPending}
            >
              <RefreshCw className={`size-3.5 ${regenerate.isPending ? "animate-spin text-primary" : ""}`} />
              Regenerate
            </Button>
          )}
          {onComplete && (
            <Button size="sm" className="press flex-1 rounded-2xl gap-1 text-xs" onClick={onComplete}>
              Done
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full space-y-4">
      {/* Header with Progress Bar and Counter */}
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
            <Brain className="size-4" /> Card {currentIndex + 1} of {cards.length}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium text-muted-foreground">
              {cards.length - currentIndex} remaining
            </span>
            {itemId && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  regenerate.mutate();
                }}
                disabled={regenerate.isPending}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                title="Regenerate 5 fresh cards"
              >
                <RefreshCw className={`size-3 ${regenerate.isPending ? "animate-spin text-primary" : ""}`} />
                <span>Regenerate (5)</span>
              </button>
            )}
          </div>
        </div>
        <Progress value={progressPercent} className="h-1.5 rounded-full bg-muted" />
      </div>

      {/* Main Flashcard with Premium Border and Alignment */}
      <div
        role="button"
        tabIndex={0}
        onClick={flip}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            flip();
          }
        }}
        className={`group relative w-full min-h-[260px] cursor-pointer select-none rounded-3xl p-6 text-left transition-all duration-300 flex flex-col justify-between border shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30 ${
          flipped
            ? "border-emerald-500/30 bg-gradient-to-b from-card to-emerald-500/[0.04] dark:from-card dark:to-emerald-500/[0.07]"
            : "border-border/90 bg-gradient-to-b from-card to-muted/30 hover:border-primary/40 dark:border-border/70"
        }`}
      >
        {/* Card Top Label */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/40">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
              flipped
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-primary/10 text-primary"
            }`}
          >
            {flipped ? "Answer" : "Question"}
          </span>

          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">
            <RotateCcw className="size-3 transition-transform group-hover:rotate-180 duration-500" />
            {flipped ? "Click to see question" : "Click to flip"}
          </span>
        </div>

        {/* Card Body Content */}
        <div className="py-5 min-h-[130px] flex items-center justify-center text-center">
          <div className="text-sm sm:text-base font-normal leading-relaxed text-foreground w-full max-w-prose">
            <MessageResponse>{flipped ? card?.back ?? "" : card?.front ?? ""}</MessageResponse>
          </div>
        </div>

        {/* Card Footer Hint */}
        <div className="pt-2 border-t border-border/40 text-center">
          {!flipped ? (
            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
              <span>Tap to reveal answer</span>
              <span className="text-muted-foreground/50">·</span>
              <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono border border-border/50">
                Space
              </kbd>
            </p>
          ) : (
            <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 flex items-center justify-center gap-1">
              <span>Rate your recall below to schedule repetition</span>
            </p>
          )}
        </div>
      </div>

      {/* Action Area: 2 Options when flipped */}
      {flipped ? (
        <div className="w-full space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="grid grid-cols-2 gap-3 w-full">
            {/* Option 1: Still Learning */}
            <Button
              type="button"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                handleReviewAction("learning");
              }}
              disabled={review.isPending}
              className="press h-13 rounded-2xl border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50 text-amber-700 dark:text-amber-300 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs"
            >
              <RotateCcw className="size-4 shrink-0 text-amber-500" />
              <div className="flex flex-col items-start text-left">
                <span>Still Learning</span>
                <span className="text-[10px] font-normal text-muted-foreground">
                  Review soon (<kbd className="font-mono">1</kbd> or <kbd className="font-mono">←</kbd>)
                </span>
              </div>
            </Button>

            {/* Option 2: Got It */}
            <Button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleReviewAction("got_it");
              }}
              disabled={review.isPending}
              className="press h-13 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <CheckCircle2 className="size-4 shrink-0 text-emerald-100" />
              <div className="flex flex-col items-start text-left">
                <span>Got It!</span>
                <span className="text-[10px] font-normal text-emerald-100/80">
                  Mastered (<kbd className="font-mono">2</kbd> or <kbd className="font-mono">→</kbd>)
                </span>
              </div>
            </Button>
          </div>
        </div>
      ) : (
        <div className="w-full flex items-center justify-center pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={flip}
            className="press rounded-2xl text-xs gap-1.5 border-border/80 hover:border-primary/40"
          >
            <span>Reveal Answer</span>
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
