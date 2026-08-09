import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, ExternalLink, Highlighter, Loader2 } from "lucide-react";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

import { Button } from "@/components/ui/button";
import type { ResourceHighlight } from "@/lib/study";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version || "4.4.168"}/build/pdf.worker.min.mjs`;

/**
 * A calm PDF reader: page-by-page, with a floating "Save to highlights" action that
 * saves any text selection directly into "Your Highlights".
 */
export default function PdfReader({
  fileUrl,
  highlights = [],
  onHighlight,
  onText,
}: {
  fileUrl: string;
  highlights?: ResourceHighlight[];
  onHighlight: (page: number, quote: string) => void;
  onText?: (text: string, pageCount: number) => void;
}) {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState("");
  const [width, setWidth] = useState(720);
  const wrapRef = useRef<HTMLDivElement>(null);
  const extracted = useRef(false);

  useEffect(() => {
    const measure = () => {
      const w = wrapRef.current?.clientWidth;
      if (w) setWidth(Math.min(900, w - 24));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const pageHighlights = useMemo(
    () => highlights.filter((h) => h.page === page),
    [highlights, page],
  );

  const options = useMemo(() => ({ isEvalSupported: false }), []);

  return (
    <div ref={wrapRef} className="relative">
      <Document
        file={fileUrl}
        options={options}
        loading={
          <div className="flex items-center justify-center gap-2 py-16 text-base text-muted-foreground">
            <Loader2 className="size-5 animate-spin" /> Opening document…
          </div>
        }
        onLoadError={(err) => {
          console.error("[PdfReader Error]", err);
        }}
        error={
          <div className="card-soft mx-auto my-8 max-w-md p-8 text-center">
            <p className="text-base text-muted-foreground">
              This document could not be previewed in the inline reader.
            </p>
            <Button asChild className="press mt-4 gap-1.5 rounded-2xl text-base">
              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" /> Open PDF in browser
              </a>
            </Button>
          </div>
        }
        onLoadSuccess={async (doc) => {
          setNumPages(doc.numPages);
          if (extracted.current || !onText) return;
          extracted.current = true;
          try {
            const chunks: string[] = [];
            const limit = Math.min(doc.numPages, 2000);
            for (let i = 1; i <= limit; i++) {
              const p = await doc.getPage(i);
              const content = await p.getTextContent();
              chunks.push(
                `\n\n--- page ${i} ---\n` +
                  content.items
                    .map((item) => ("str" in item ? (item as { str: string }).str : ""))
                    .join(" "),
              );
            }
            onText(chunks.join(""), doc.numPages);
          } catch {
            /* extraction is best-effort */
          }
        }}
      >
        <div
          className="flex justify-center"
          onMouseUp={() => setSelection(window.getSelection()?.toString().trim() ?? "")}
        >
          <Page
            pageNumber={page}
            width={width}
            className="overflow-hidden rounded-2xl border border-border shadow-sm text-base"
            renderAnnotationLayer
            renderTextLayer
          />
        </div>
      </Document>

      <div className="mt-5 flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="default"
          className="rounded-xl h-10 px-4 text-base"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft className="size-5 mr-1" /> Previous
        </Button>
        <span className="text-base font-medium tabular-nums text-foreground">
          Page {page} of {numPages || "…"}
        </span>
        <Button
          variant="outline"
          size="default"
          className="rounded-xl h-10 px-4 text-base"
          aria-label="Next page"
          disabled={numPages > 0 && page >= numPages}
          onClick={() => setPage((p) => Math.min(numPages || p + 1, p + 1))}
        >
          Next <ChevronRight className="size-5 ml-1" />
        </Button>
      </div>

      {pageHighlights.length > 0 && (
        <div className="mt-3 flex items-center justify-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 py-1.5 px-3.5 rounded-full w-max mx-auto">
          <Highlighter className="size-4" />
          {pageHighlights.length} highlight{pageHighlights.length !== 1 ? "s" : ""} saved on this
          page
        </div>
      )}

      {selection.length > 2 && (
        <div className="sticky bottom-4 mt-4 flex justify-center">
          <Button
            className="press gap-2 rounded-2xl px-5 py-3 text-base shadow-xl bg-primary text-primary-foreground font-semibold"
            onClick={() => {
              onHighlight(page, selection);
              setSelection("");
              window.getSelection()?.removeAllRanges();
            }}
          >
            <Highlighter className="size-5" /> Save to highlights
          </Button>
        </div>
      )}
    </div>
  );
}
