import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { generateCheckpointForItem } from "@/lib/quiz.functions";
import type { QuizQuestion } from "@/lib/agents/quiz-generator.server";

export function CheckpointGate({
  itemId,
  isDone,
  onToggleDone,
}: {
  itemId: string;
  isDone: boolean;
  onToggleDone: (done: boolean) => void;
}) {
  const runCheckpoint = useServerFn(generateCheckpointForItem);

  const [active, setActive] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [passed, setPassed] = useState(false);
  const [failed, setFailed] = useState(false);

  const fetchCheck = useMutation({
    mutationFn: () => runCheckpoint({ data: { itemId } }),
    onSuccess: (res) => {
      if (res.success && res.questions && res.questions.length > 0) {
        setQuestions(res.questions);
        setAnswers({});
        setActive(true);
        setPassed(false);
        setFailed(false);
      } else {
        // Fallback: if checkpoint fails to generate, allow marking directly
        onToggleDone(!isDone);
      }
    },
  });

  const handleCheckboxClick = () => {
    if (isDone) {
      // Unchecking doesn't require a checkpoint
      onToggleDone(false);
      return;
    }
    // If not done, trigger checkpoint check
    fetchCheck.mutate();
  };

  const handleVerify = () => {
    const allCorrect = questions.every((q, idx) => {
      const userAns = answers[idx] ?? "";
      return userAns.trim() === q.correct_answer.trim();
    });

    if (allCorrect) {
      setPassed(true);
      setFailed(false);
      onToggleDone(true);
    } else {
      setFailed(true);
      setPassed(false);
    }
  };

  if (fetchCheck.isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="size-4 animate-spin text-primary" />
        <span>Preparing quick 2-question self-check…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
        <Checkbox checked={isDone} onCheckedChange={handleCheckboxClick} className="rounded-md" />
        <span>Mark as learned</span>
      </label>

      {active && !isDone && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            <h4 className="font-display text-sm font-semibold text-primary">
              Quick Self-Check (2 Questions)
            </h4>
          </div>

          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div key={idx} className="space-y-2 text-xs">
                <p className="font-semibold text-foreground">
                  {idx + 1}. {q.question}
                </p>
                {q.options && (
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {q.options.map((opt, oIdx) => {
                      const selected = answers[idx] === opt;
                      return (
                        <button
                          key={oIdx}
                          type="button"
                          onClick={() => setAnswers((prev) => ({ ...prev, [idx]: opt }))}
                          className={`rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                            selected
                              ? "bg-primary text-primary-foreground font-medium"
                              : "bg-background/80 hover:bg-background border border-border"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {failed && (
            <p className="text-xs text-red-600 dark:text-red-400">
              Not quite right yet. Review the lesson sections above and try again!
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="press rounded-xl text-xs"
              onClick={() => setActive(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="press rounded-xl text-xs"
              disabled={Object.keys(answers).length < questions.length}
              onClick={handleVerify}
            >
              Verify & Complete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
