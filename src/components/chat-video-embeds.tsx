import { Play } from "lucide-react";

const YT_RE =
  /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/g;

/** Pulls unique YouTube video ids out of a markdown/plain text answer. */
export function youtubeIdsIn(text: string): string[] {
  const ids: string[] = [];
  for (const match of text.matchAll(YT_RE)) {
    const id = match[1];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids.slice(0, 4);
}

/**
 * Renders inline YouTube players for any video Remi mentions, so a learner can
 * watch straight from the conversation instead of leaving for a new tab.
 */
export function ChatVideoEmbeds({ text }: { text: string }) {
  const ids = youtubeIdsIn(text);
  if (ids.length === 0) return null;

  return (
    <div className="mt-3 space-y-3">
      {ids.map((id) => (
        <div key={id} className="overflow-hidden rounded-2xl border border-border bg-muted/30">
          <iframe
            src={`https://www.youtube.com/embed/${id}`}
            title="Recommended video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className="aspect-video w-full"
          />
          <a
            href={`https://www.youtube.com/watch?v=${id}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <Play className="size-3.5 text-primary" />
            Open on YouTube
          </a>
        </div>
      ))}
    </div>
  );
}
