import { useState } from "react";
import { BookmarkPlus, CheckCircle2, Loader2, Play } from "lucide-react";

import { extractYouTubeId, getYouTubeEmbedUrl, getYouTubeWatchUrl } from "@/lib/youtube";

// Matches any URL or markdown link containing youtube or youtu.be
const YT_URL_SCANNER =
  /https?:\/\/(?:[a-zA-Z0-9-]+\.)?(?:youtube\.com|youtu\.be)\/[^\s)>\]"]+/gi;

/** Pulls unique YouTube video ids out of a markdown/plain text answer. */
export function youtubeIdsIn(text: string): string[] {
  if (!text) return [];
  const ids: string[] = [];
  const matches = text.match(YT_URL_SCANNER);

  if (matches) {
    for (const url of matches) {
      const id = extractYouTubeId(url);
      if (id && !ids.includes(id)) {
        ids.push(id);
      }
    }
  }

  return ids.slice(0, 4);
}

/**
 * Renders inline YouTube players for any video Remi mentions, so a learner can
 * watch straight from the conversation instead of leaving for a new tab.
 *
 * Pass `onAddToLibrary` to show an "Add to Library" button per video.
 */
export function ChatVideoEmbeds({
  text,
  onAddToLibrary,
}: {
  text: string;
  onAddToLibrary?: (videoId: string) => Promise<void>;
}) {
  const ids = youtubeIdsIn(text);
  if (ids.length === 0) return null;

  return (
    <div className="mt-3 space-y-3">
      {ids.map((id) => (
        <VideoEmbedCard
          key={id}
          videoId={id}
          {...(onAddToLibrary ? { onAddToLibrary } : {})}
        />
      ))}
    </div>
  );
}

function VideoEmbedCard({
  videoId,
  onAddToLibrary,
}: {
  videoId: string;
  onAddToLibrary?: (videoId: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const handleAdd = async () => {
    if (!onAddToLibrary || adding || added) return;
    setAdding(true);
    try {
      await onAddToLibrary(videoId);
      setAdded(true);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-muted/30">
      <iframe
        src={getYouTubeEmbedUrl(videoId)}
        title="Recommended video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
        className="aspect-video w-full"
      />
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
        <a
          href={getYouTubeWatchUrl(videoId)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Play className="size-3.5 text-primary" />
          Open on YouTube
        </a>

        {onAddToLibrary && (
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={adding || added}
            className={[
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer select-none border",
              added
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 cursor-default"
                : adding
                  ? "bg-primary/10 text-primary border-primary/20 opacity-70 cursor-wait"
                  : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 hover:border-primary/30",
            ].join(" ")}
            aria-label="Add video to library"
          >
            {adding ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : added ? (
              <CheckCircle2 className="size-3.5" />
            ) : (
              <BookmarkPlus className="size-3.5" />
            )}
            {added ? "Added to Library" : "Add to Library"}
          </button>
        )}
      </div>
    </div>
  );
}
