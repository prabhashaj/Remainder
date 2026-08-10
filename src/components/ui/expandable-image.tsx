"use client";

import * as React from "react";
import { ExternalLink, ImageIcon, Maximize2 } from "lucide-react";

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ExpandableImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt?: string | undefined;
  caption?: string | null | undefined;
  containerClassName?: string | undefined;
  imageClassName?: string | undefined;
  showCaption?: boolean | undefined;
}

export function ExpandableImage({
  src,
  alt = "Image preview",
  caption,
  containerClassName,
  imageClassName,
  showCaption = true,
  className,
  ...props
}: ExpandableImageProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [imgSrc, setImgSrc] = React.useState(src);
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    setImgSrc(src);
    setHasError(false);
  }, [src]);

  const handleError = () => {
    if (hasError) return;
    setHasError(true);
  };

  if (hasError) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <div
          className={cn(
            "group relative flex flex-col cursor-pointer overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-xs transition-all hover:border-primary/50 hover:shadow-md max-w-2xl my-3.5",
            containerClassName,
          )}
          role="button"
          tabIndex={0}
          aria-label={`Expand image: ${caption || alt}`}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsOpen(true);
            }
          }}
        >
          <div className="relative w-full overflow-hidden bg-background/40 flex items-center justify-center p-1 sm:p-2 min-h-[180px]">
            <img
              src={imgSrc}
              alt={alt}
              loading="lazy"
              onError={handleError}
              className={cn(
                "w-full h-auto max-h-[520px] object-contain rounded-xl transition-transform duration-200 group-hover:scale-[1.01]",
                imageClassName,
                className,
              )}
              {...props}
            />
            {/* Top-right subtle zoom button on hover (no blur overlay over image) */}
            <div className="absolute top-3 right-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1 text-[11px] font-semibold text-foreground shadow-md border border-border/60 backdrop-blur-md">
                <Maximize2 className="size-3 text-primary" />
                Expand
              </span>
            </div>
          </div>

          {showCaption && caption && (
            <div className="flex items-center justify-between gap-2 border-t border-border/40 bg-muted/40 px-3.5 py-2.5 text-xs font-medium leading-relaxed text-muted-foreground/90 rounded-b-2xl">
              <div className="flex items-center gap-2 truncate">
                <ImageIcon className="size-3.5 text-primary/70 shrink-0" />
                <span className="truncate">{caption}</span>
              </div>
              <span className="text-[10px] text-muted-foreground/60 shrink-0">Click to expand</span>
            </div>
          )}
        </div>
      </DialogTrigger>

      <DialogContent className="max-w-5xl border-border/80 bg-background/95 p-2 shadow-2xl backdrop-blur-xl sm:p-4 md:p-6">
        <DialogTitle className="sr-only">{caption || alt}</DialogTitle>
        <div className="relative flex max-h-[85vh] flex-col items-center justify-center overflow-hidden rounded-xl">
          {/* Top Control Bar */}
          <div className="mb-2 flex w-full items-center justify-between px-2">
            <span className="max-w-[70%] truncate text-xs font-medium text-muted-foreground">
              {caption || alt}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-xl px-3 text-xs"
                asChild
              >
                <a href={src} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" />
                  Open original
                </a>
              </Button>
            </div>
          </div>

          {/* Full Image */}
          <div className="relative flex max-h-[75vh] w-full items-center justify-center overflow-auto rounded-lg bg-black/10 p-1 dark:bg-black/40">
            <img
              src={src}
              alt={alt}
              className="max-h-[70vh] w-auto max-w-full rounded-md object-contain shadow-lg"
            />
          </div>

          {/* Expanded Caption */}
          {caption && <p className="mt-3 text-center text-xs text-muted-foreground">{caption}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
