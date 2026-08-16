import { log } from "./logger.server";

export async function extractPdfTextServer(buffer: Buffer): Promise<string> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;

    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      const pageText = content.items
        .map((item) => {
          if ("str" in item && typeof item.str === "string") {
            return item.hasEOL ? `${item.str}\n` : item.str;
          }
          return "";
        })
        .join(" ");

      const cleanedPageText = pageText
        .replace(/[ \t]+/g, " ")
        .replace(/\n /g, "\n")
        .trim();

      if (cleanedPageText) {
        fullText += `--- Page ${i} ---\n${cleanedPageText}\n\n`;
      }
    }

    const result = fullText.trim();
    log("info", "pdf_extraction_success", {
      pages: pdf.numPages,
      chars: result.length,
    });
    return result;
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    const errType = err instanceof Error ? err.constructor.name : typeof err;
    log("error", "pdf_extraction_failed", {
      errType,
      errMessage,
      stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
    });
    return "";
  }
}
