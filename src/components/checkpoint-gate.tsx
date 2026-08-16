import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, CheckCircle2, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { useState } from "react";

import { MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { QuizQuestion } from "@/lib/agents/quiz-generator.server";
import { checkMcqCorrect, cleanOptionText, getOptionLetterUpper } from "@/lib/quiz-eval";
import { generateCheckpointForItem } from "@/lib/quiz.functions";

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
  const [scoreInfo, setScoreInfo] = useState<{ correct: number; total: number } | null>(null);

  const fetchCheck = useMutation({
    mutationFn: () => runCheckpoint({ data: { itemId } }),
    onSuccess: (res) => {
      if (res.success && res.questions && res.questions.length > 0) {
        setQuestions(res.questions);
        setAnswers({});
        setActive(true);
        setPassed(false);
        setFailed(false);
        setScoreInfo(null);
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
      setActive(false);
      setPassed(false);
      return;
    }
    // If not done, trigger checkpoint check
    fetchCheck.mutate();
  };

  const handleVerify = () => {
    let correctCount = 0;
    questions.forEach((q, idx) => {
      const userAns = answers[idx] ?? "";
      if (checkMcqCorrect(userAns, q.correct_answer, q.options)) {
        correctCount++;
      }
    });

    const total = questions.length;
    setScoreInfo({ correct: correctCount, total });

    if (correctCount === total) {
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
      <div className="inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary">
        <Sparkles className="size-4 animate-spin text-primary shrink-0" />
        <span>Preparing quick self-check…</span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-2.5">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
          <Checkbox checked={isDone} onCheckedChange={handleCheckboxClick} className="rounded-md" />
          <span>Mark as learned</span>
        </label>
        {isDone && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" /> Completed
          </span>
        )}
      </div>

      {active && !isDone && (
        <div className="w-full rounded-3xl border border-primary/25 bg-card/90 p-5 sm:p-6 shadow-soft space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h4 className="font-display text-base font-bold text-foreground">
                  Quick Self-Check
                </h4>
                <p className="text-xs text-muted-foreground">
                  Answer all questions correctly to complete this lesson.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {questions.length} Questions
            </span>
          </div>

          {/* Questions list */}
          <div className="space-y-6">
            {questions.map((q, idx) => {
              const userAns = answers[idx] ?? "";
              const isQCorrect = checkMcqCorrect(userAns, q.correct_answer, q.options);

              return (
                <div
                  key={idx}
                  className="space-y-3 rounded-2xl border border-border/80 bg-muted/20 p-4 sm:p-5"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Question {idx + 1} of {questions.length}
                    </span>
                  </div>

                  <div className="text-sm font-medium text-foreground">
                    <MessageResponse>{q.question}</MessageResponse>
                  </div>

                  {q.options && q.options.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {q.options.map((opt, oIdx) => {
                        const selected = userAns === opt;
                        const optIsCorrect = checkMcqCorrect(opt, q.correct_answer, q.options);

                        let optionStyle =
                          "border-border/80 bg-background hover:bg-muted/60 text-foreground";

                        if (selected) {
                          optionStyle =
                            "border-2 border-primary bg-primary/10 text-foreground font-semibold shadow-sm";
                        }

                        if (failed) {
                          if (optIsCorrect) {
                            optionStyle =
                              "border-2 border-emerald-500 bg-emerald-500/10 font-semibold text-emerald-700 dark:text-emerald-300";
                          } else if (selected && !isQCorrect) {
                            optionStyle =
                              "border-2 border-red-500 bg-red-500/10 font-semibold text-red-700 dark:text-red-300";
                          }
                        }

                        return (
                          <button
                            key={oIdx}
                            type="button"
                            onClick={() => {
                              setAnswers((prev) => ({ ...prev, [idx]: opt }));
                              if (failed) setFailed(false);
                            }}
                            className={`group flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm transition-all ${optionStyle}`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                {getOptionLetterUpper(oIdx)}
                              </span>
                              <span className="leading-relaxed">{cleanOptionText(opt)}</span>
                            </div>
                            <div className="ml-2 shrink-0">
                              {failed && optIsCorrect && (
                                <CheckCircle2 className="size-4.5 text-emerald-600 dark:text-emerald-400" />
                              )}
                              {failed && selected && !isQCorrect && (
                                <XCircle className="size-4.5 text-red-500" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Status feedback */}
          {failed && scoreInfo && (
            <div className="flex items-center gap-2.5 rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-xs font-medium text-red-700 dark:text-red-300">
              <AlertCircle className="size-4.5 shrink-0 text-red-500" />
              <div>
                <p className="font-bold">
                  {scoreInfo.correct} of {scoreInfo.total} questions correct
                </p>
                <p className="text-red-600/90 dark:text-red-400/90">
                  Review the correct answers highlighted in green above and try again!
                </p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="press rounded-2xl text-xs font-medium"
              onClick={() => {
                setActive(false);
                setFailed(false);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="press rounded-2xl px-5 text-xs font-bold"
              disabled={Object.keys(answers).length < questions.length}
              onClick={handleVerify}
            >
              Verify & Complete
            </Button>
          </div>
        </div>
      )}

      {passed && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-bold">Checkpoint Passed! Lesson marked as learned.</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 rounded-xl"
            onClick={() => {
              setActive(false);
              setPassed(false);
            }}
          >
            Done
          </Button>
        </div>
      )}
    </div>
  );
}
