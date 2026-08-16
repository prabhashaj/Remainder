import { extractText, getDocumentProxy } from "unpdf";
import { log } from "./logger.server";

export async function extractPdfTextServer(buffer: Buffer): Promise<string> {
  try {
    const data = new Uint8Array(buffer);

    // getDocumentProxy applies sensible serverless defaults:
    // - useSystemFonts: true
    // - disableFontFace: true (Node)
    // - cMapUrl / cMapPacked resolved from bundled pdfjs-dist
    // - standardFontDataUrl resolved from bundled pdfjs-dist
    // This avoids the font/cmap resolution failures that raw pdfjs-dist
    // causes in Vercel serverless functions when processing LaTeX/arXiv PDFs.
    const pdf = await getDocumentProxy(data);

    // mergePages: false gives us per-page strings so we can add page headers
    const { totalPages, text: pages } = await extractText(pdf, { mergePages: false });

    const pagesArray = Array.isArray(pages) ? pages : [pages];

    let fullText = "";
    for (let i = 0; i < pagesArray.length; i++) {
      const pageText = (pagesArray[i] ?? "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n /g, "\n")
        .trim();

      if (pageText) {
        fullText += `--- Page ${i + 1} ---\n${pageText}\n\n`;
      }
    }

    const result = fullText.trim();

    log("info", "pdf_extraction_success", {
      library: "unpdf",
      pages: totalPages,
      chars: result.length,
    });

    return result;
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    const errType = err instanceof Error ? err.constructor.name : typeof err;
    log("error", "pdf_extraction_failed", {
      library: "unpdf",
      errType,
      errMessage,
      stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
    });
    return "";
  }
}
