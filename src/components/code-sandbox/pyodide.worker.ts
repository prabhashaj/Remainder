/// <reference lib="webworker" />

declare const self: DedicatedWorkerGlobalScope;

interface Pyodide {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runPythonAsync: (code: string) => Promise<any>;
  loadPackage: (names: string | string[]) => Promise<void>;
  loadPackagesFromImports: (code: string) => Promise<void>;
  setStdout: (options: { batched: (msg: string) => void }) => void;
  setStderr: (options: { batched: (msg: string) => void }) => void;
  setInterruptBuffer: (buffer: Int32Array) => void;
}

declare function loadPyodide(options: { indexURL: string }): Promise<Pyodide>;

let pyodideReadyPromise: Promise<Pyodide> | null = null;
let pyodideInstance: Pyodide | null = null;

let currentRunId: string | null = null;

async function initPyodide() {
  if (!pyodideReadyPromise) {
    pyodideReadyPromise = (async () => {
      const pyodideModule =
        await import("https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.mjs");

      const pyodide = await pyodideModule.loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/",
      });

      pyodide.setStdout({
        batched: (msg: string) => {
          if (currentRunId) {
            self.postMessage({ type: "stdout", text: msg, runId: currentRunId });
          }
        },
      });
      pyodide.setStderr({
        batched: (msg: string) => {
          if (currentRunId) {
            self.postMessage({ type: "stderr", text: msg, runId: currentRunId });
          }
        },
      });

      return pyodide;
    })();
  }
  return pyodideReadyPromise;
}

let isExecuting = false;
let executionQueue: Array<{
  id: string;
  code: string;
  interruptBuffer: Int32Array | null;
  runId: string;
}> = [];

async function processQueue() {
  if (isExecuting || executionQueue.length === 0) return;
  isExecuting = true;

  const { id, code, interruptBuffer, runId } = executionQueue.shift()!;
  currentRunId = runId;

  try {
    if (!pyodideInstance) {
      pyodideInstance = await initPyodide();
    }

    if (interruptBuffer && pyodideInstance.setInterruptBuffer) {
      pyodideInstance.setInterruptBuffer(interruptBuffer);
    }

    // Extract imports and load packages manually as a fallback
    const importRegex = /^(?:import|from)\s+([a-zA-Z0-9_]+)/gm;
    let match;
    const packages = new Set<string>();
    while ((match = importRegex.exec(code)) !== null) {
      packages.add(match[1]);
    }
    for (const pkg of packages) {
      if (!pkg) continue;
      try {
        await pyodideInstance.loadPackage(pkg);
      } catch (e) {
        console.warn(`Could not load package ${pkg}:`, e);
      }
    }

    await pyodideInstance.loadPackagesFromImports(code);
    const result = await pyodideInstance.runPythonAsync(code);
    
    // If the last expression evaluates to something (like a Jupyter notebook cell), print it
    if (result !== undefined && result !== null) {
      const output = String(result);
      if (output.trim()) {
        self.postMessage({ type: "stdout", text: output + "\n", runId });
      }
    }
    
    self.postMessage({ id, type: "run_success", runId });
  } catch (err) {
    self.postMessage({ id, type: "run_error", error: String(err), runId });
  } finally {
    currentRunId = null;
    isExecuting = false;
    processQueue();
  }
}

self.onmessage = async (event) => {
  const { id, type, code, interruptBuffer, runId } = event.data;

  if (type === "init") {
    try {
      pyodideInstance = await initPyodide();
      self.postMessage({ id, type: "init_success" });
    } catch (err) {
      self.postMessage({ id, type: "init_error", error: String(err) });
    }
  } else if (type === "run") {
    executionQueue.push({ id, code, interruptBuffer, runId });
    processQueue();
  }
};

export {};
