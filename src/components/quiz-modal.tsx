import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, HelpCircle, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { generateQuizForItem, submitQuizAttempt } from "@/lib/quiz.functions";
import type { QuizQuestion } from "@/lib/agents/quiz-generator.server";
import { checkMcqCorrect, cleanOptionText, getOptionLetterUpper } from "@/lib/quiz-eval";
import { MessageResponse } from "@/components/ai-elements/message";

type QuestionState = {
  question: QuizQuestion;
  userAnswer: string;
};

export function QuizModal({
  itemId,
  itemTitle,
  open,
  onOpenChange,
}: {
  itemId: string;
  itemTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const runGenerateQuiz = useServerFn(generateQuizForItem);
  const runSubmitQuiz = useServerFn(submitQuizAttempt);

  const [questions, setQuestions] = useState<QuestionState[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [resultScore, setResultScore] = useState<number | null>(null);

  const generate = useMutation({
    mutationFn: () => runGenerateQuiz({ data: { itemId } }),
    onSuccess: (res) => {
      if (res.success && res.quiz?.questions) {
        setQuestions(
          res.quiz.questions.map((q) => ({
            question: q,
            userAnswer: "",
          })),
        );
        setAnswers({});
        setSubmitted(false);
        setResultScore(null);
      } else {
        toast.error(res.error || "Could not generate quiz.");
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to generate quiz");
    },
  });

  const submit = useMutation({
    mutationFn: () => {
      const formatted = questions.map((q, idx) => {
        const userAns = answers[idx] ?? "";
        let isCorrect = false;

        if (q.question.type === "mcq") {
          isCorrect = checkMcqCorrect(userAns, q.question.correct_answer, q.question.options);
        } else {
          const normalizedUser = userAns.toLowerCase().trim();
          const normalizedCorrect = q.question.correct_answer.toLowerCase().trim();
          isCorrect =
            normalizedUser.length > 0 &&
            (normalizedUser.includes(normalizedCorrect) ||
              normalizedCorrect.includes(normalizedUser));
        }

        return {
          question: q.question.question,
          correct_answer: q.question.correct_answer,
          user_answer: userAns,
          is_correct: isCorrect,
        };
      });

      return runSubmitQuiz({
        data: {
          itemId,
          questions: formatted,
        },
      });
    },
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.error || "Submission failed");
        return;
      }
      setSubmitted(true);
      setResultScore(res.score);
      toast.success(`Quiz completed! Score: ${res.score}%`);
      void qc.invalidateQueries({ queryKey: ["roadmap-item", itemId] });
      void qc.invalidateQueries({ queryKey: ["roadmap-items"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && questions.length === 0 && !generate.isPending) {
      generate.mutate();
    }
    onOpenChange(nextOpen);
  };

  const handleAttemptSubmit = () => {
    const unansweredCount = questions.filter((_, idx) => !(answers[idx] ?? "").trim()).length;

    if (unansweredCount > 0) {
      toast.warning(`Please answer all ${questions.length} questions before submitting.`);
      return;
    }

    submit.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold">Quiz: {itemTitle}</DialogTitle>
        </DialogHeader>

        {generate.isPending ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <RefreshCw className="size-6 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">
              Remi is writing quiz questions for this lesson…
            </p>
          </div>
        ) : questions.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Ready to test your understanding?</p>
            <Button className="press mt-4 rounded-2xl" onClick={() => generate.mutate()}>
              Generate Quiz
            </Button>
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {submitted && resultScore !== null && (
              <div
                className={`rounded-2xl p-4 text-center ${
                  resultScore >= 70
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "bg-muted text-foreground border border-border"
                }`}
              >
                <h4 className="font-display text-lg font-bold">Score: {resultScore}%</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  {resultScore >= 70
                    ? "Great understanding! Keep up the good work."
                    : "Review the lesson content to strengthen your grasp."}
                </p>
              </div>
            )}

            {questions.map(({ question }, idx) => {
              const userAns = answers[idx] ?? "";
              let isCorrect = false;

              if (question.type === "mcq") {
                isCorrect = checkMcqCorrect(userAns, question.correct_answer, question.options);
              } else {
                const normalizedUser = userAns.toLowerCase().trim();
                const normalizedCorrect = question.correct_answer.toLowerCase().trim();
                isCorrect =
                  normalizedUser.length > 0 &&
                  (normalizedUser.includes(normalizedCorrect) ||
                    normalizedCorrect.includes(normalizedUser));
              }

              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-border/80 bg-card p-4 space-y-3"
                >
                  <div className="flex items-start gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {idx + 1}
                    </span>
                    <div className="flex-1 text-sm font-medium">
                      <MessageResponse>{question.question}</MessageResponse>
                    </div>
                  </div>

                  {question.type === "mcq" && question.options && question.options.length > 0 ? (
                    <div className="space-y-2.5 pl-8">
                      {question.options.map((opt, optIdx) => {
                        const selected = userAns === opt;
                        const optIsCorrect = checkMcqCorrect(
                          opt,
                          question.correct_answer,
                          question.options,
                        );
                        let optionStyle =
                          "border border-border/80 bg-muted/40 text-foreground hover:bg-muted/80";

                        if (selected) {
                          optionStyle =
                            "border-2 border-primary bg-primary/15 text-primary font-semibold shadow-sm";
                        }

                        if (submitted) {
                          if (optIsCorrect) {
                            optionStyle =
                              "border-2 border-emerald-500 bg-emerald-500/15 font-semibold text-emerald-700 dark:text-emerald-300";
                          } else if (selected && !isCorrect) {
                            optionStyle =
                              "border-2 border-red-500 bg-red-500/15 font-semibold text-red-700 dark:text-red-300";
                          }
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            disabled={submitted}
                            onClick={() => setAnswers((prev) => ({ ...prev, [idx]: opt }))}
                            className={`group flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm transition-all ${optionStyle}`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                {getOptionLetterUpper(optIdx)}
                              </span>
                              <span className="leading-relaxed">{cleanOptionText(opt)}</span>
                            </div>
                            <div className="ml-3 shrink-0">
                              {submitted && optIsCorrect && (
                                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                              )}
                              {submitted && selected && !isCorrect && (
                                <XCircle className="size-4 text-red-500" />
                              )}
                              {!submitted && selected && (
                                <div className="size-3 rounded-full bg-primary" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="pl-8">
                      <Input
                        value={userAns}
                        disabled={submitted}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                        placeholder="Write your answer..."
                        className="rounded-xl"
                      />
                    </div>
                  )}

                  {submitted && (
                    <div className="ml-8 rounded-xl bg-muted/60 p-3 text-xs space-y-1">
                      <p className="font-semibold text-muted-foreground">
                        Correct Answer: {question.correct_answer}
                      </p>
                      <p className="text-muted-foreground">{question.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="press rounded-2xl text-muted-foreground"
                onClick={() => generate.mutate()}
                disabled={generate.isPending}
              >
                <RefreshCw className="mr-1.5 size-3.5" />
                New Questions
              </Button>

              {!submitted ? (
                <Button
                  className="press rounded-2xl px-6"
                  onClick={handleAttemptSubmit}
                  disabled={submit.isPending}
                >
                  {submit.isPending ? "Submitting…" : "Submit Quiz"}
                </Button>
              ) : (
                <Button className="press rounded-2xl" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
