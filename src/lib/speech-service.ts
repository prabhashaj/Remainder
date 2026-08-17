/**
 * Production-hardened Web Speech API (SpeechSynthesis) engine for Remispace.
 *
 * Solves known browser quirks:
 * 1. Premature Garbage Collection: Utterances are retained in an active Set to prevent V8/WebKit GC dropouts.
 * 2. 15-Second Cut-off / Buffer Limit: Breaks text into natural sentence & clause chunks (100-200 chars).
 * 3. Chrome Keepalive: Automatic heartbeat (pause/resume ping) prevents silent disconnects on long passages.
 * 4. Multi-instance Synchronization: Centralized singleton store ensures one active speech session at a time.
 * 5. Asynchronous Voice Loading & Fallbacks: Handles Chrome/Safari voice loading delays and falls back gracefully.
 */

import { useSyncExternalStore } from "react";
import { toast } from "sonner";

export const VOICE_STORAGE_KEY = "remispace-preferred-voice";
export const RATE_STORAGE_KEY = "remispace-preferred-rate";

export type PlaybackStatus = "idle" | "playing" | "paused";

export interface SpeechState {
  status: PlaybackStatus;
  activeId: string | null;
  currentChunkIndex: number;
  totalChunks: number;
  rate: number;
  selectedVoiceName: string;
  voices: SpeechSynthesisVoice[];
  isSupported: boolean;
}

/**
 * Clean markdown, LaTeX math formulas, tables, and special characters
 * so speech synthesis sounds natural, fluent, and pleasant.
 */
export function cleanTextForSpeech(text: string): string {
  if (!text || typeof text !== "string") return "";

  let clean = text;

  // 1. Remove code blocks completely or replace with spoken summary
  clean = clean.replace(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g, " (Code snippet omitted) ");
  clean = clean.replace(/```[\s\S]*?```/g, " ");
  clean = clean.replace(/`([^`]+)`/g, "$1"); // inline code

  // 2. LaTeX & Math cleanups for natural educational speech
  // Fractions: \frac{a}{b} or \dfrac{a}{b} -> "a over b"
  clean = clean.replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1 over $2");
  // Square roots: \sqrt{x} -> "square root of x", \sqrt[n]{x} -> "n-th root of x"
  clean = clean.replace(/\\sqrt\[([^{}]+)\]\{([^{}]+)\}/g, "$1-th root of $2");
  clean = clean.replace(/\\sqrt\{([^{}]+)\}/g, "square root of $1");

  // Common math symbols & operators
  clean = clean.replace(/\\times|\\cdot/g, " times ");
  clean = clean.replace(/\\div/g, " divided by ");
  clean = clean.replace(/\\pm/g, " plus or minus ");
  clean = clean.replace(/\\neq|\\ne/g, " not equal to ");
  clean = clean.replace(/\\leq|\\le/g, " less than or equal to ");
  clean = clean.replace(/\\geq|\\ge/g, " greater than or equal to ");
  clean = clean.replace(/\\approx|\\thickapprox|\\sim/g, " approximately ");
  clean = clean.replace(/\\infty/g, " infinity ");
  clean = clean.replace(/\\rightarrow|\\to|\\implies/g, " leads to ");
  clean = clean.replace(/\\leftarrow/g, " from ");
  clean = clean.replace(/\\sum_?\{?([^{}]*)\}?\^?\{?([^{}]*)\}?/g, " sum of ");
  clean = clean.replace(/\\int_?\{?([^{}]*)\}?\^?\{?([^{}]*)\}?/g, " integral of ");
  clean = clean.replace(/\\partial/g, " partial derivative of ");
  clean = clean.replace(/\\degree|°/g, " degrees ");
  clean = clean.replace(/\\%|%/g, " percent ");

  // Greek letters
  clean = clean.replace(/\\pi/g, " pi ");
  clean = clean.replace(/\\theta/g, " theta ");
  clean = clean.replace(/\\alpha/g, " alpha ");
  clean = clean.replace(/\\beta/g, " beta ");
  clean = clean.replace(/\\gamma/g, " gamma ");
  clean = clean.replace(/\\delta/g, " delta ");
  clean = clean.replace(/\\Delta/g, " change in ");
  clean = clean.replace(/\\lambda/g, " lambda ");
  clean = clean.replace(/\\sigma/g, " sigma ");
  clean = clean.replace(/\\omega/g, " omega ");
  clean = clean.replace(/\\mu/g, " micro ");
  clean = clean.replace(/\\phi/g, " phi ");
  clean = clean.replace(/\\rho/g, " rho ");

  // Powers: x^2 -> "x squared", x^3 -> "x cubed", x^n -> "x to the power of n"
  clean = clean.replace(/(\w+)\^2\b/g, "$1 squared");
  clean = clean.replace(/(\w+)\^3\b/g, "$1 cubed");
  clean = clean.replace(/(\w+)\^{?([^{}\s]+)}?/g, "$1 to the power of $2");

  // Subscripts: x_1 -> "x 1", a_{n} -> "a n"
  clean = clean.replace(/(\w+)_{?([^{}\s]+)}?/g, "$1 $2");

  // Formatting macros: \text{...}, \mathbf{...}, \mathit{...}, \textbf{...}
  clean = clean.replace(/\\[a-zA-Z]+\{([^{}]+)\}/g, "$1");
  // Clean lingering delimiters: $$, $, \{, \}, \left, \right
  clean = clean.replace(/\$\$|\$|\\\{|\\\}|\\left|\\right|\\/g, " ");

  // 3. Markdown Cleanups
  // Markdown tables: convert | header | col | to clean text
  clean = clean.replace(/^\s*\|(.+)\|\s*$/gm, (_, row) => {
    // Ignore separator rows like |---|---|
    if (/^[\s|:-]+$/.test(row)) return " ";
    return (
      row
        .split("|")
        .map((cell: string) => cell.trim())
        .filter(Boolean)
        .join(", ") + ". "
    );
  });

  // Remove images and badges
  clean = clean.replace(/!\[.*?\]\(.*?\)/g, " ");
  // Links: [Text](url) -> "Text"
  clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Standalone URLs: replace with friendly text so long URLs aren't spelled out character-by-character
  clean = clean.replace(/https?:\/\/(?:www\.)?([^\s/$.?#].[^\s]*)/gi, (_, domain) => {
    return ` link at ${domain.split("/")[0]} `;
  });

  // Headers: # Title -> Title
  clean = clean.replace(/^#{1,6}\s+/gm, "");
  // Blockquotes: > Quote -> Quote
  clean = clean.replace(/^\s*>\s+/gm, "");
  // Lists: - item, * item, + item, 1. item -> item
  clean = clean.replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, ""); // task lists
  clean = clean.replace(/^\s*[-*+]\s+/gm, "");
  clean = clean.replace(/^\s*\d+\.\s+/gm, "");

  // Bold & Italics & Strikethrough
  clean = clean.replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1");

  // Horizontal rules
  clean = clean.replace(/^---+$/gm, " ");

  // HTML tags & entities
  clean = clean.replace(/<[^>]*>/g, " ");
  clean = clean.replace(/&nbsp;/g, " ");
  clean = clean.replace(/&amp;/g, " and ");
  clean = clean.replace(/&lt;/g, " less than ");
  clean = clean.replace(/&gt;/g, " greater than ");
  clean = clean.replace(/&quot;/g, '"');
  clean = clean.replace(/&#39;/g, "'");

  // Normalize excessive whitespace and punctuation
  clean = clean
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/([.?!])\s*([.?!])+/g, "$1")
    .trim();

  return clean;
}

/**
 * Splits text into small, natural spoken chunks (100–220 characters max).
 * Ensures sentences or natural clauses are kept together so speech flows smoothly
 * and avoids Chrome's 15-second utterance timeout bug.
 */
export function chunkText(text: string, maxChunkLength = 180): string[] {
  if (!text) return [];

  const rawChunks: string[] = [];

  // Split by sentence boundaries, preserving decimals (e.g. 5.4, 3.14) without breaking them
  const sentenceRegex = /(?:[^.!?;\n]|\.(?!\s|\n|$)|(?<=\d)\.(?=\d))+[.!?;\n]*(?:\s+|$)/g;
  const sentences = text.match(sentenceRegex) || [text];

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;

    if (sentence.length <= maxChunkLength) {
      rawChunks.push(sentence);
    } else {
      // Split sentence into clauses by commas, colons, dashes
      const clauseRegex = /(?:[^,:\u2014-]|\.(?!\s|\n|$)|(?<=\d)\.(?=\d))+[,:\u2014-]*(?:\s+|$)/g;
      const clauses = sentence.match(clauseRegex) || [sentence];
      let currentChunk = "";

      for (const rawClause of clauses) {
        const clause = rawClause.trim();
        if (!clause) continue;

        if ((currentChunk + " " + clause).trim().length <= maxChunkLength) {
          currentChunk = (currentChunk + " " + clause).trim();
        } else {
          if (currentChunk) {
            rawChunks.push(currentChunk);
            currentChunk = "";
          }
          if (clause.length <= maxChunkLength) {
            currentChunk = clause;
          } else {
            // Split long clause by word boundaries
            const words = clause.split(/\s+/);
            let wordChunk = "";
            for (const word of words) {
              if ((wordChunk + " " + word).trim().length <= maxChunkLength) {
                wordChunk = (wordChunk + " " + word).trim();
              } else {
                if (wordChunk) rawChunks.push(wordChunk);
                wordChunk = word;
              }
            }
            if (wordChunk) currentChunk = wordChunk;
          }
        }
      }

      if (currentChunk) {
        rawChunks.push(currentChunk);
      }
    }
  }

  return rawChunks.filter((c) => c.length > 0);
}

/**
 * Score and prioritize voices:
 * 1. High-quality Neural / Natural Indian English voices
 * 2. Natural / Neural English voices
 * 3. Other Indian English voices
 * 4. General English voices
 * 5. Other system voices
 */
function getVoiceRank(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.replace("_", "-").toLowerCase();
  const isIndianLang = lang.includes("in") || name.includes("india");

  // Top Indian Natural / Neural Voices
  if (name.includes("neerja")) return 1; // Microsoft Neerja Natural (Female)
  if (name.includes("prabhat")) return 2; // Microsoft Prabhat Natural (Male)
  if (name.includes("google") && isIndianLang) return 3; // Google English (India)
  if (name.includes("veena") || name.includes("rishi") || name.includes("heera")) return 4; // Apple Veena / Rishi
  if (isIndianLang && (name.includes("natural") || name.includes("neural") || name.includes("online")))
    return 5;
  if (isIndianLang) return 6;

  // Natural English Voices (US, UK, Global)
  if (
    (name.includes("natural") || name.includes("neural") || name.includes("wavenet")) &&
    lang.startsWith("en")
  )
    return 7;
  if (
    name.includes("jenny") ||
    name.includes("aria") ||
    name.includes("guy") ||
    name.includes("samantha") ||
    name.includes("daniel")
  )
    return 8;
  if (name.includes("google") && lang.startsWith("en")) return 9;
  if (lang.startsWith("en")) return 10;
  if (voice.default) return 11;

  return 12;
}

export function sortVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return [...voices].sort((a, b) => {
    const rankA = getVoiceRank(a);
    const rankB = getVoiceRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name);
  });
}

const SERVER_SNAPSHOT: SpeechState = {
  status: "idle",
  activeId: null,
  currentChunkIndex: 0,
  totalChunks: 0,
  rate: 1.0,
  selectedVoiceName: "",
  voices: [],
  isSupported: false,
};

/**
 * Core Speech Engine Singleton
 */
class SpeechEngine {
  private status: PlaybackStatus = "idle";
  private activeId: string | null = null;
  private currentChunks: string[] = [];
  private currentChunkIndex = 0;
  private rate = 1.0;
  private selectedVoiceName = "";
  private voices: SpeechSynthesisVoice[] = [];
  private isSupported = false;

  // Cached snapshot reference to prevent infinite re-render loops with useSyncExternalStore
  private snapshot: SpeechState = SERVER_SNAPSHOT;

  // Active utterance reference retention to prevent V8/WebKit garbage-collection bugs
  private activeUtterances = new Set<SpeechSynthesisUtterance>();
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.isSupported = true;
      this.initStorage();
      this.syncSnapshot();
      this.initVoices();
    }
  }

  private initStorage() {
    try {
      const storedVoice = window.localStorage.getItem(VOICE_STORAGE_KEY);
      if (storedVoice) this.selectedVoiceName = storedVoice;

      const storedRate = window.localStorage.getItem(RATE_STORAGE_KEY);
      if (storedRate) {
        const parsed = parseFloat(storedRate);
        if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 2.0) {
          this.rate = parsed;
        }
      }
    } catch {
      // Storage unavailable / private mode
    }
  }

  private initVoices() {
    if (!this.isSupported) return;

    const load = () => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const list = window.speechSynthesis.getVoices();
      if (list && list.length > 0) {
        this.voices = sortVoices(list);
        if (!this.selectedVoiceName) {
          const defaultVoice = this.getDefaultVoice();
          if (defaultVoice) {
            this.selectedVoiceName = defaultVoice.name;
          }
        }
        this.syncSnapshot();
      }
    };

    load();

    // Event listener for asynchronous voice loading
    if (typeof window.speechSynthesis.addEventListener === "function") {
      window.speechSynthesis.addEventListener("voiceschanged", load);
    } else {
      (window.speechSynthesis as unknown as { onvoiceschanged: (() => void) | null }).onvoiceschanged = load;
    }

    // Polling retry for initial Chrome delay
    setTimeout(load, 100);
    setTimeout(load, 500);
    setTimeout(load, 1500);
  }

  private syncSnapshot() {
    this.snapshot = {
      status: this.status,
      activeId: this.activeId,
      currentChunkIndex: this.currentChunkIndex,
      totalChunks: this.currentChunks.length,
      rate: this.rate,
      selectedVoiceName: this.selectedVoiceName,
      voices: this.voices,
      isSupported: this.isSupported,
    };
    this.listeners.forEach((listener) => listener());
  }

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public getSnapshot = (): SpeechState => {
    return this.snapshot;
  };

  public getServerSnapshot = (): SpeechState => {
    return SERVER_SNAPSHOT;
  };

  public getDefaultVoice(): SpeechSynthesisVoice | null {
    if (this.voices.length === 0) {
      const list =
        typeof window !== "undefined" && "speechSynthesis" in window
          ? window.speechSynthesis.getVoices()
          : [];
      if (list.length > 0) {
        this.voices = sortVoices(list);
      }
    }
    if (this.voices.length === 0) return null;

    if (this.selectedVoiceName) {
      const match = this.voices.find((v) => v.name === this.selectedVoiceName);
      if (match) return match;
    }

    // Return the top-ranked available voice
    return this.voices[0] ?? null;
  }

  public setVoice(voiceName: string) {
    this.selectedVoiceName = voiceName;
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(VOICE_STORAGE_KEY, voiceName);
      }
    } catch {}
    this.syncSnapshot();
  }

  public setRate(rate: number) {
    this.rate = rate;
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(RATE_STORAGE_KEY, String(rate));
      }
    } catch {}

    // If currently speaking, restarting from current chunk applies the new speed immediately
    if (this.status === "playing") {
      this.speakCurrentChunk();
    } else {
      this.syncSnapshot();
    }
  }

  /**
   * Chrome keepalive timer prevents silent playback drops after 10-15 seconds.
   */
  private startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveInterval = setInterval(() => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const synth = window.speechSynthesis;
      if (synth.speaking && !synth.paused) {
        synth.pause();
        synth.resume();
      }
    }, 9000);
  }

  private stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  /**
   * Start or toggle reading for a given text and ID.
   */
  public toggle(text: string, id: string) {
    if (!this.isSupported) {
      toast.error("Text-to-speech is not supported in this browser.");
      return;
    }

    // If clicking on the currently active speech session
    if (this.activeId === id) {
      if (this.status === "playing") {
        this.pause();
      } else if (this.status === "paused") {
        this.resume();
      } else {
        this.start(text, id);
      }
      return;
    }

    // Otherwise start fresh with the new text
    this.start(text, id);
  }

  public start(text: string, id: string) {
    if (!this.isSupported) return;

    this.stop();

    const clean = cleanTextForSpeech(text);
    if (!clean) {
      toast.error("No text available to read aloud.");
      return;
    }

    const chunks = chunkText(clean);
    if (chunks.length === 0) {
      toast.error("No readable text found.");
      return;
    }

    this.activeId = id;
    this.currentChunks = chunks;
    this.currentChunkIndex = 0;
    this.status = "playing";

    this.startKeepAlive();
    this.speakCurrentChunk();
  }

  private speakCurrentChunk() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;

    // Clear active utterance references and cancel current speech
    this.activeUtterances.clear();
    synth.cancel();

    // Chrome audio engine unlock
    if (synth.paused) {
      synth.resume();
    }

    if (this.currentChunkIndex >= this.currentChunks.length) {
      this.finish();
      return;
    }

    const chunk = this.currentChunks[this.currentChunkIndex];
    if (!chunk) {
      this.finish();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunk);
    // Retain persistent reference against garbage collector
    this.activeUtterances.add(utterance);

    const voice = this.getDefaultVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";
    }

    utterance.rate = this.rate;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      this.status = "playing";
      this.syncSnapshot();
    };

    utterance.onend = () => {
      this.activeUtterances.delete(utterance);
      if (this.status === "playing") {
        this.currentChunkIndex++;
        if (this.currentChunkIndex < this.currentChunks.length) {
          this.speakCurrentChunk();
        } else {
          this.finish();
        }
      }
    };

    utterance.onerror = (e) => {
      this.activeUtterances.delete(utterance);
      // "interrupted" or "canceled" are standard events triggered when stopping or switching
      if (e.error !== "interrupted" && e.error !== "canceled") {
        console.warn("SpeechSynthesis error:", e.error);
      }
      if (this.status === "playing" && e.error !== "interrupted" && e.error !== "canceled") {
        this.currentChunkIndex++;
        if (this.currentChunkIndex < this.currentChunks.length) {
          this.speakCurrentChunk();
        } else {
          this.finish();
        }
      }
    };

    // Small timeout to allow synth.cancel() to settle in Chrome/Safari
    setTimeout(() => {
      if (this.status === "playing") {
        synth.speak(utterance);
      }
    }, 20);

    this.syncSnapshot();
  }

  public pause() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    this.status = "paused";
    this.stopKeepAlive();
    window.speechSynthesis.pause();
    this.syncSnapshot();
  }

  public resume() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    this.status = "playing";
    this.startKeepAlive();
    const synth = window.speechSynthesis;
    if (synth.paused) {
      synth.resume();
    } else {
      // If browser resume is unresponsive, continue chunk playback directly
      this.speakCurrentChunk();
    }
    this.syncSnapshot();
  }

  public stop() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }
    this.stopKeepAlive();
    this.activeUtterances.clear();
    this.status = "idle";
    this.activeId = null;
    this.currentChunks = [];
    this.currentChunkIndex = 0;
    this.syncSnapshot();
  }

  private finish() {
    this.stopKeepAlive();
    this.activeUtterances.clear();
    this.status = "idle";
    this.activeId = null;
    this.currentChunks = [];
    this.currentChunkIndex = 0;
    this.syncSnapshot();
  }

  /**
   * Preview a voice with a quick sample phrase
   */
  public previewVoice(voice: SpeechSynthesisVoice, sampleText?: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();

    const phrase =
      sampleText ||
      (voice.lang.toLowerCase().includes("in")
        ? "Hello! I am Remi. Ready to help you master this lesson."
        : "Hello! I am Remi, your study assistant.");

    const utterance = new SpeechSynthesisUtterance(phrase);
    this.activeUtterances.add(utterance);

    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = this.rate;

    utterance.onend = () => {
      this.activeUtterances.delete(utterance);
    };
    utterance.onerror = () => {
      this.activeUtterances.delete(utterance);
    };

    synth.speak(utterance);
  }
}

// Global Singleton Instance
export const speechService = new SpeechEngine();

/**
 * React hook to interact with the Speech Engine with zero tearing and instant state syncing.
 */
export function useSpeech() {
  const state = useSyncExternalStore(
    speechService.subscribe,
    speechService.getSnapshot,
    speechService.getServerSnapshot
  );

  return {
    ...state,
    toggle: (text: string, id: string) => speechService.toggle(text, id),
    start: (text: string, id: string) => speechService.start(text, id),
    pause: () => speechService.pause(),
    resume: () => speechService.resume(),
    stop: () => speechService.stop(),
    setVoice: (voiceName: string) => speechService.setVoice(voiceName),
    setRate: (rate: number) => speechService.setRate(rate),
    previewVoice: (voice: SpeechSynthesisVoice) => speechService.previewVoice(voice),
    getDefaultVoice: () => speechService.getDefaultVoice(),
  };
}
