import { Check, Copy, Volume2, VolumeX, Pause, Play, Settings2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const VOICE_STORAGE_KEY = "remainder-preferred-voice";
const RATE_STORAGE_KEY = "remainder-preferred-rate";

/**
 * Clean markdown formatting tags so speech synthesis speaks natural plain text.
 */
export function cleanTextForSpeech(text: string): string {
  if (!text) return "";
  return text
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/`([^`]+)`/g, "$1") // Remove inline code ticks
    .replace(/#+\s+/g, "") // Remove markdown headers
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold
    .replace(/\*([^*]+)\*/g, "$1") // Remove italics
    .replace(/!\[.*?\]\(.*?\)/g, "") // Remove images
    .replace(/\[([^\]]+)\]\(.*?\)/g, "$1") // Remove link syntax
    .replace(/>\s+/g, "") // Remove blockquotes
    .replace(/[-*+]\s+/g, "") // Remove list bullets
    .replace(/\$\$/g, "") // Remove display math tags
    .replace(/\$/g, "") // Remove inline math tags
    .trim();
}

/**
 * Returns available browser voices sorted with high-quality Indian English voices first.
 */
export function getSortedVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return [];

  // Filter Indian voices or English voices
  return [...voices].sort((a, b) => {
    const aLang = a.lang.replace("_", "-").toLowerCase();
    const bLang = b.lang.replace("_", "-").toLowerCase();
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();

    const aIsIndian = aLang.includes("in") || aName.includes("india");
    const bIsIndian = bLang.includes("in") || bName.includes("india");

    if (aIsIndian && !bIsIndian) return -1;
    if (!aIsIndian && bIsIndian) return 1;

    const aIsNatural =
      aName.includes("natural") || aName.includes("google") || aName.includes("microsoft");
    const bIsNatural =
      bName.includes("natural") || bName.includes("google") || bName.includes("microsoft");

    if (aIsNatural && !bIsNatural) return -1;
    if (!aIsNatural && bIsNatural) return 1;

    return a.name.localeCompare(b.name);
  });
}

/**
 * Gets default preferred Indian voice
 */
export function getDefaultIndianVoice(): SpeechSynthesisVoice | null {
  const voices = getSortedVoices();
  if (voices.length === 0) return null;

  // Check stored voice preference
  if (typeof window !== "undefined") {
    const storedName = window.localStorage.getItem(VOICE_STORAGE_KEY);
    if (storedName) {
      const found = voices.find((v) => v.name === storedName);
      if (found) return found;
    }
  }

  // Look for Microsoft Neerja Natural, Microsoft Prabhat Natural, or Google English India
  const preferred = voices.find(
    (v) =>
      v.name.toLowerCase().includes("neerja") ||
      v.name.toLowerCase().includes("prabhat") ||
      (v.name.toLowerCase().includes("google") && v.lang.toLowerCase().includes("in")) ||
      v.name.toLowerCase().includes("natural") ||
      v.name.toLowerCase().includes("veena") ||
      v.name.toLowerCase().includes("rishi"),
  );

  return preferred ?? voices[0] ?? null;
}

export function ReadAloudButton({ text, className }: { text: string; className?: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("");
  const [rate, setRate] = useState<number>(0.92);

  // Load voices and stored settings
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const updateVoices = () => {
      const available = getSortedVoices();
      setVoices(available);

      const storedVoice = window.localStorage.getItem(VOICE_STORAGE_KEY);
      const defaultVoice = getDefaultIndianVoice();

      if (storedVoice && available.some((v) => v.name === storedVoice)) {
        setSelectedVoiceName(storedVoice);
      } else if (defaultVoice) {
        setSelectedVoiceName(defaultVoice.name);
      }

      const storedRate = window.localStorage.getItem(RATE_STORAGE_KEY);
      if (storedRate) {
        const parsed = parseFloat(storedRate);
        if (!isNaN(parsed)) setRate(parsed);
      }
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Stop speaking on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSelectVoice = useCallback((voiceName: string) => {
    setSelectedVoiceName(voiceName);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(VOICE_STORAGE_KEY, voiceName);
    }
  }, []);

  const handleSelectRate = useCallback((newRate: number) => {
    setRate(newRate);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RATE_STORAGE_KEY, String(newRate));
    }
  }, []);

  const handleStop = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Text-to-speech is not supported in this browser.");
      return;
    }

    const synth = window.speechSynthesis;

    if (isPlaying) {
      if (isPaused) {
        synth.resume();
        setIsPaused(false);
      } else {
        synth.pause();
        setIsPaused(true);
      }
      return;
    }

    synth.cancel();

    const clean = cleanTextForSpeech(text);
    if (!clean) {
      toast.error("No text available to read aloud.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(clean);
    const available = getSortedVoices();
    const chosenVoice =
      available.find((v) => v.name === selectedVoiceName) || getDefaultIndianVoice();

    if (chosenVoice) {
      utterance.voice = chosenVoice;
      utterance.lang = chosenVoice.lang;
    } else {
      utterance.lang = "en-IN";
    }

    utterance.rate = rate;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onerror = (e) => {
      console.error("SpeechSynthesis error:", e);
      setIsPlaying(false);
      setIsPaused(false);
    };

    synth.speak(utterance);
  }, [text, isPlaying, isPaused, selectedVoiceName, rate]);

  return (
    <div className="inline-flex items-center gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleTogglePlay}
              className={`press rounded-xl gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors ${
                isPlaying
                  ? "bg-primary/15 text-primary hover:bg-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              } ${className ?? ""}`}
            >
              {isPlaying ? (
                isPaused ? (
                  <>
                    <Play className="size-3.5 fill-primary text-primary" />
                    <span>Resume</span>
                  </>
                ) : (
                  <>
                    <Pause className="size-3.5 fill-primary text-primary" />
                    <span className="flex items-center gap-1">
                      <span>Reading</span>
                      <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                    </span>
                  </>
                )
              ) : (
                <>
                  <Volume2 className="size-3.5 text-primary" />
                  <span>Read aloud</span>
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>
              {isPlaying
                ? isPaused
                  ? "Resume reading"
                  : "Pause reading"
                : "Listen in clear Indian voice (en-IN)"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {isPlaying && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleStop}
                className="h-7 w-7 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <VolumeX className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Stop reading</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Voice & Speed Settings Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 rounded-xl text-muted-foreground/70 hover:bg-muted hover:text-foreground"
          >
            <Settings2 className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 rounded-2xl p-2 shadow-xl">
          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">
            Voice & Speed Controls
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="my-1" />

          {/* Speed Selector */}
          <div className="px-2 py-1.5">
            <span className="text-xs font-medium text-foreground block mb-1.5">Speech Speed</span>
            <div className="flex gap-1">
              {[0.8, 0.92, 1.0, 1.15].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleSelectRate(r)}
                  className={`flex-1 rounded-lg py-1 text-xs font-semibold transition-colors ${
                    rate === r ? "bg-primary text-primary-foreground" : "bg-muted/60 hover:bg-muted"
                  }`}
                >
                  {r === 0.92 ? "0.9x Clear" : `${r}x`}
                </button>
              ))}
            </div>
          </div>

          <DropdownMenuSeparator className="my-1.5" />

          {/* Voice Selector */}
          <div className="px-2 py-1">
            <span className="text-xs font-medium text-foreground block mb-1">Select Voice</span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
            {voices.length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                Default Indian English (en-IN)
              </div>
            ) : (
              voices.slice(0, 10).map((v) => {
                const isSelected = v.name === selectedVoiceName;
                const isIndian =
                  v.lang.toLowerCase().includes("in") || v.name.toLowerCase().includes("india");
                const isNatural =
                  v.name.toLowerCase().includes("natural") ||
                  v.name.toLowerCase().includes("neerja") ||
                  v.name.toLowerCase().includes("prabhat");

                return (
                  <DropdownMenuItem
                    key={v.name}
                    onClick={() => handleSelectVoice(v.name)}
                    className={`rounded-xl px-2.5 py-1.5 text-xs font-medium cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected ? "bg-primary/15 text-primary font-semibold" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1 truncate">
                      <span className="truncate block">{v.name}</span>
                      <span className="text-[10px] text-muted-foreground block">{v.lang}</span>
                    </div>
                    {isNatural && (
                      <span className="shrink-0 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-semibold">
                        Neural
                      </span>
                    )}
                    {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                  </DropdownMenuItem>
                );
              })
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy text");
    }
  }, [text]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className={`press rounded-xl gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${
              className ?? ""
            }`}
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-600" />
                <span className="text-emerald-600 font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5 text-muted-foreground" />
                <span>Copy</span>
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{copied ? "Copied!" : "Copy message to clipboard"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SpeechAndCopyToolbar({ text, className }: { text: string; className?: string }) {
  if (!text || !text.trim()) return null;

  return (
    <div className={`flex items-center gap-1.5 pt-2 border-t border-border/40 ${className ?? ""}`}>
      <ReadAloudButton text={text} />
      <CopyButton text={text} />
    </div>
  );
}
