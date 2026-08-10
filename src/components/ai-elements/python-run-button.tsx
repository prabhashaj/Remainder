import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Square, Loader2, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from "./code-block";

let sharedWorker: Worker | null = null;
let sharedInterruptBuffer: Int32Array | null = null;
let initPromise: Promise<void> | null = null;

function getSharedWorker() {
  if (!sharedWorker) {
    sharedWorker = new Worker(new URL("../code-sandbox/pyodide.worker.ts", import.meta.url), {
      type: "module",
    });

    if (typeof SharedArrayBuffer !== "undefined") {
      const sab = new SharedArrayBuffer(4);
      sharedInterruptBuffer = new Int32Array(sab);
    }
  }
  return { worker: sharedWorker, interruptBuffer: sharedInterruptBuffer };
}

export function PlayableCodeBlock({
  code,
  language,
  className,
}: {
  code: string;
  language: string;
  className?: string;
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const runIdRef = useRef<string | null>(null);

  useEffect(() => {
    const { worker } = getSharedWorker();

    const onMessage = (e: MessageEvent) => {
      const { type, text, error, runId } = e.data;

      if (type === "init_success") {
        setIsLoading(false);
      } else if (type === "init_error") {
        console.error("Pyodide init error:", error);
        if (isLoading) setIsLoading(false);
      }

      if (runId && runId === runIdRef.current) {
        if (type === "stdout" || type === "stderr") {
          setOutput((prev) => (prev || "") + text + "\n");
        } else if (type === "run_success") {
          setIsRunning(false);
          runIdRef.current = null;
        } else if (type === "run_error") {
          setOutput((prev) => (prev || "") + `\nError: ${error}\n`);
          setIsRunning(false);
          runIdRef.current = null;
        }
      }
    };

    worker.addEventListener("message", onMessage);
    return () => {
      worker.removeEventListener("message", onMessage);
    };
  }, [isLoading]);

  const initWorker = useCallback(async () => {
    setIsLoading(true);
    const { worker } = getSharedWorker();

    if (!initPromise) {
      initPromise = new Promise((resolve) => {
        const handler = (e: MessageEvent) => {
          if (e.data.type === "init_success" || e.data.type === "init_error") {
            worker.removeEventListener("message", handler);
            resolve();
          }
        };
        worker.addEventListener("message", handler);
        worker.postMessage({ id: "init", type: "init" });
      });
    }

    await initPromise;
    setIsLoading(false);
  }, []);

  const handleRun = async () => {
    await initWorker();

    const runId = Math.random().toString(36).substring(2, 15);
    runIdRef.current = runId;

    setIsRunning(true);
    setShowOutput(true);
    setOutput("");

    const { worker, interruptBuffer } = getSharedWorker();

    if (interruptBuffer) {
      interruptBuffer[0] = 0; // Clear interrupt
    }

    worker.postMessage({
      id: "run",
      type: "run",
      code,
      interruptBuffer,
      runId,
    });
  };

  const handleStop = () => {
    const { interruptBuffer, worker } = getSharedWorker();
    if (interruptBuffer) {
      interruptBuffer[0] = 2; // SIGINT
    } else {
      // If we terminate the shared worker, we must clear it so a new one can be created
      worker.terminate();
      sharedWorker = null;
      sharedInterruptBuffer = null;
      initPromise = null;

      setIsRunning(false);
      runIdRef.current = null;
      setOutput((prev) => (prev || "") + "\n[Execution terminated]\n");
    }
  };

  return (
    <div className={cn("relative flex flex-col gap-2 my-4", className)}>
      <CodeBlock code={code} language={language} className="shadow-sm" showLineNumbers>
        <CodeBlockHeader>
          <CodeBlockTitle className="text-xs uppercase tracking-wider text-muted-foreground">
            {language}
          </CodeBlockTitle>
          <CodeBlockActions>
            {isRunning ? (
              <Button
                size="icon-sm"
                variant="ghost"
                className="h-7 w-7 text-destructive"
                onClick={handleStop}
                title="Stop"
              >
                <Square className="size-3.5 fill-current" />
              </Button>
            ) : (
              <Button
                size="icon-sm"
                variant="ghost"
                className="h-7 w-7 text-primary hover:text-primary/80"
                onClick={handleRun}
                disabled={isLoading}
                title="Run Code"
              >
                {isLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5 fill-current" />
                )}
              </Button>
            )}
            <CodeBlockCopyButton />
          </CodeBlockActions>
        </CodeBlockHeader>
      </CodeBlock>

      {showOutput && (
        <div className="w-full bg-zinc-950 text-zinc-50 p-3 rounded-md shadow-sm border border-zinc-800 text-xs font-mono max-h-60 overflow-y-auto">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-800 text-zinc-400">
            <span className="flex items-center gap-1">
              <Terminal className="size-3" /> Output
            </span>
            <button onClick={() => setShowOutput(false)} className="hover:text-zinc-100">
              Close
            </button>
          </div>
          {output?.trim() ? (
            <pre className="whitespace-pre-wrap">{output}</pre>
          ) : isRunning ? (
            <span className="text-zinc-500 italic animate-pulse">Running...</span>
          ) : (
            <span className="text-zinc-500 italic">Execution completed. (No output)</span>
          )}
        </div>
      )}
    </div>
  );
}
