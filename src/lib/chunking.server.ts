/**
 * Semantic-aware text chunker for RAG over large documents (textbooks, papers, etc.).
 *
 * Strategy:
 * - Split first on structural boundaries extracted by the PDF parser:
 *   "--- Page N ---" markers, markdown headings, chapter/section titles.
 * - Within each section, apply a sliding window (1500 chars / 300 overlap)
 *   that prefers paragraph > sentence > word breaks.
 * - Each chunk carries optional page metadata for citation support.
 */

export interface TextChunk {
  /** The chunk text content */
  content: string;
  /** 1-indexed page number if detected from "--- Page N ---" markers, else null */
  pageNumber: number | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Boundary patterns that separate structural sections in extracted PDF text */
const SECTION_BOUNDARY_RE =
  /(?=--- Page \d+ ---)|(?=\n#{1,4} )|(?=\n(?:Chapter|Section|CHAPTER|SECTION)\s+[\dIVXivx]+)/g;

/**
 * Split text into rough structural sections, keeping track of the most recent
 * page number seen so each section inherits it.
 */
function splitIntoSections(text: string): Array<{ content: string; pageNumber: number | null }> {
  const parts = text.split(SECTION_BOUNDARY_RE);
  const sections: Array<{ content: string; pageNumber: number | null }> = [];
  let currentPage: number | null = null;

  for (const part of parts) {
    if (!part || !part.trim()) continue;

    // Detect "--- Page N ---" at the very start of this section
    const pageMatch = part.match(/^--- Page (\d+) ---/);
    if (pageMatch) {
      currentPage = parseInt(pageMatch[1]!, 10);
    }

    sections.push({ content: part.trim(), pageNumber: currentPage });
  }

  return sections;
}

/**
 * Slide a window over `text` producing chunks of at most `chunkSize` chars,
 * breaking at paragraph > sentence > word boundaries, with `overlap` backtrack.
 */
function slideWindow(
  text: string,
  chunkSize: number,
  overlap: number,
): string[] {
  if (text.length <= chunkSize) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    if (end >= text.length) {
      chunks.push(text.slice(start).trim());
      break;
    }

    // Search for a good break in the last 20% of the window
    const searchStart = Math.max(start, start + Math.floor(chunkSize * 0.8));
    const searchArea = text.slice(searchStart, end);
    let breakOffset = -1;

    const dbl = searchArea.lastIndexOf("\n\n");
    if (dbl !== -1) {
      breakOffset = searchStart - start + dbl + 2;
    } else {
      const sngl = searchArea.lastIndexOf("\n");
      const period = searchArea.lastIndexOf(". ");
      if (sngl !== -1) {
        breakOffset = searchStart - start + sngl + 1;
      } else if (period !== -1) {
        breakOffset = searchStart - start + period + 2;
      } else {
        const space = searchArea.lastIndexOf(" ");
        if (space !== -1) breakOffset = searchStart - start + space + 1;
      }
    }

    if (breakOffset > 0) end = start + breakOffset;

    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    start = end - overlap;
    if (start >= end) start = end; // safety — always advance
  }

  return chunks.filter((c) => c.length > 0);
}

// ---------------------------------------------------------------------------
// Public API — simple string array (backward-compatible with existing callers)
// ---------------------------------------------------------------------------

/**
 * Chunk `text` into overlapping segments suitable for embedding.
 *
 * Drop-in replacement for the old `chunkText` — same signature, richer output.
 * Defaults kept compatible: callers that don't pass params get the new defaults.
 */
export function chunkText(
  text: string,
  chunkSize: number = 1500,
  overlap: number = 300,
): string[] {
  return chunkTextWithMeta(text, chunkSize, overlap).map((c) => c.content);
}

/**
 * Like `chunkText` but returns rich metadata alongside each chunk.
 * Used by the document processor to store `page_number` per chunk.
 */
export function chunkTextWithMeta(
  text: string,
  chunkSize: number = 1500,
  overlap: number = 300,
): TextChunk[] {
  if (!text || !text.trim()) return [];

  const normalized = text.replace(/\r\n/g, "\n");
  const sections = splitIntoSections(normalized);
  const result: TextChunk[] = [];

  for (const section of sections) {
    const windows = slideWindow(section.content, chunkSize, overlap);
    for (const w of windows) {
      if (w.trim().length > 40) {
        // Skip tiny fragments
        result.push({ content: w, pageNumber: section.pageNumber });
      }
    }
  }

  return result;
}
