import {
  Check,
  Copy,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Settings2,
  Sparkles,
  Volume1,
} from "lucide-react";
import { useCallback, useState } from "react";
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
import {
  cleanTextForSpeech,
  speechService,
  useSpeech,
  VOICE_STORAGE_KEY,
  RATE_STORAGE_KEY,
} from "@/lib/speech-service";

// Re-export cleaner and helpers for backward compatibility
export { cleanTextForSpeech, VOICE_STORAGE_KEY, RATE_STORAGE_KEY };

export function getSortedVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return speechService.getSnapshot().voices;
}

export function getDefaultIndianVoice(): SpeechSynthesisVoice | null {
  return speechService.getDefaultVoice();
}

/**
 * Generate a deterministic identifier for any text content so independent
 * message buttons on the same page don't clash.
 */
function getSpeechId(text: string, customId?: string): string {
  if (customId) return customId;
  let hash = 0;
  for (let i = 0; i < Math.min(text.length, 120); i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return `msg_${Math.abs(hash)}_${text.length}`;
}

export function ReadAloudButton({
  text,
  className,
  id,
}: {
  text: string;
  className?: string | undefined;
  id?: string | undefined;
}) {
  const speechId = getSpeechId(text, id);
  const {
    status,
    activeId,
    currentChunkIndex,
    totalChunks,
    rate,
    selectedVoiceName,
    voices,
    isSupported,
    toggle,
    stop,
    setRate,
    setVoice,
    previewVoice,
  } = useSpeech();

  const isActive = activeId === speechId;
  const isPlaying = isActive && status === "playing";
  const isPaused = isActive && status === "paused";

  const handleToggle = useCallback(() => {
    if (!text || !text.trim()) {
      toast.error("No text available to read aloud.");
      return;
    }
    toggle(text, speechId);
  }, [text, speechId, toggle]);

  const handleStop = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      stop();
    },
    [stop]
  );

  const handlePreviewVoice = useCallback(
    (e: React.MouseEvent, voice: SpeechSynthesisVoice) => {
      e.stopPropagation();
      previewVoice(voice);
    },
    [previewVoice]
  );

  return (
    <div className="inline-flex items-center gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleToggle}
              className={`press rounded-xl gap-1.5 px-2.5 py-1 text-xs font-medium transition-all ${
                isPlaying
                  ? "bg-primary/15 text-primary shadow-xs ring-1 ring-primary/20 hover:bg-primary/20"
                  : isPaused
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
              } ${className ?? ""}`}
            >
              {isPlaying ? (
                <>
                  <Pause className="size-3.5 fill-primary text-primary" />
                  <span className="flex items-center gap-1.5">
                    <span>Reading</span>
                    <span className="flex items-end gap-0.5 h-3">
                      <span className="w-0.5 h-2 bg-primary rounded-full animate-pulse" />
                      <span className="w-0.5 h-3 bg-primary rounded-full animate-pulse [animation-delay:150ms]" />
                      <span className="w-0.5 h-1.5 bg-primary rounded-full animate-pulse [animation-delay:300ms]" />
                    </span>
                  </span>
                </>
              ) : isPaused ? (
                <>
                  <Play className="size-3.5 fill-amber-600 dark:fill-amber-400 text-amber-600 dark:text-amber-400" />
                  <span>Resume</span>
                </>
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
                ? totalChunks > 1
                  ? `Pause reading (Section ${currentChunkIndex + 1} of ${totalChunks})`
                  : "Pause reading"
                : isPaused
                  ? "Resume reading"
                  : "Listen with natural voice"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Stop Button */}
      {isActive && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleStop}
                className="h-7 w-7 rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
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
            className="h-7 w-7 rounded-xl text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings2 className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-76 rounded-2xl p-2.5 shadow-xl">
          <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1 flex items-center justify-between">
            <span>Voice & Audio Settings</span>
            <Sparkles className="size-3 text-primary/70" />
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="my-1.5" />

          {/* Speed Selector */}
          <div className="px-2 py-1.5">
            <span className="text-xs font-medium text-foreground block mb-2">Speech Speed</span>
            <div className="grid grid-cols-4 gap-1">
              {[
                { r: 0.75, label: "0.75x" },
                { r: 1.0, label: "1.0x" },
                { r: 1.25, label: "1.25x" },
                { r: 1.5, label: "1.5x" },
              ].map(({ r, label }) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRate(r)}
                  className={`rounded-lg py-1.5 text-[11px] font-semibold transition-all ${
                    rate === r
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <DropdownMenuSeparator className="my-1.5" />

          {/* Voice Selector */}
          <div className="px-2 py-1">
            <span className="text-xs font-medium text-foreground block mb-1">Select Voice</span>
          </div>

          <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
            {voices.length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted-foreground italic">
                Browser default voice (en)
              </div>
            ) : (
              voices.slice(0, 14).map((v) => {
                const isSelected =
                  v.name === selectedVoiceName || (!selectedVoiceName && v === voices[0]);
                const isIndian =
                  v.lang.toLowerCase().includes("in") || v.name.toLowerCase().includes("india");
                const isNatural =
                  v.name.toLowerCase().includes("natural") ||
                  v.name.toLowerCase().includes("neural") ||
                  v.name.toLowerCase().includes("neerja") ||
                  v.name.toLowerCase().includes("prabhat") ||
                  v.name.toLowerCase().includes("wavenet");

                return (
                  <DropdownMenuItem
                    key={v.name}
                    onClick={() => setVoice(v.name)}
                    className={`rounded-xl px-2.5 py-1.5 text-xs font-medium cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                      isSelected
                        ? "bg-primary/15 text-primary font-semibold"
                        : "hover:bg-muted/80 text-foreground"
                    }`}
                  >
                    <div className="min-w-0 flex-1 truncate">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{v.name.replace(/(Microsoft|Google|Apple)\s*/i, "")}</span>
                        {isIndian && (
                          <span className="shrink-0 text-[9px] bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded-md font-semibold">
                            IN
                          </span>
                        )}
                        {isNatural && (
                          <span className="shrink-0 text-[9px] bg-primary/20 text-primary px-1.5 py-0.2 rounded-md font-semibold">
                            Neural
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground block truncate">
                        {v.lang}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Test voice preview button */}
                      <button
                        type="button"
                        onClick={(e) => handlePreviewVoice(e, v)}
                        title="Preview voice"
                        className="size-6 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/20 hover:text-primary transition-colors"
                      >
                        <Volume1 className="size-3.5" />
                      </button>

                      {isSelected && <Check className="size-3.5 text-primary shrink-0 ml-0.5" />}
                    </div>
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

export function CopyButton({
  text,
  className,
}: {
  text: string;
  className?: string | undefined;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
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
          <p>{copied ? "Copied!" : "Copy text to clipboard"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SpeechAndCopyToolbar({
  text,
  className,
  id,
}: {
  text: string;
  className?: string | undefined;
  id?: string | undefined;
}) {
  if (!text || !text.trim()) return null;

  return (
    <div className={`flex items-center gap-1.5 pt-2 border-t border-border/40 ${className ?? ""}`}>
      <ReadAloudButton text={text} id={id} />
      <CopyButton text={text} />
    </div>
  );
}
