"use client";

import * as React from "react";
import { ExternalLink, Maximize2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ExpandableImageProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <div
          className={cn(
            "group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-muted/30 transition-all hover:border-primary/50 hover:shadow-md",
            containerClassName
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
          <img
            src={src}
            alt={alt}
            loading="lazy"
            className={cn(
              "h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]",
              imageClassName,
              className
            )}
            {...props}
          />
          {/* Hover overlay with zoom hint */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur-md">
              <Maximize2 className="size-3.5 text-primary" />
              Expand Image
            </span>
          </div>

          {showCaption && caption && (
            <div className="border-t border-border/50 bg-background/80 px-3 py-2 text-xs leading-relaxed text-muted-foreground backdrop-blur-sm">
              {caption}
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
          {caption && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {caption}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
