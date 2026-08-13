export async function extractPdfTextServer(buffer: Buffer): Promise<string> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;

    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageText = content.items
        .map((item: any) => {
          if (typeof item.str === "string") {
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
    return fullText.trim();
  } catch (err) {
    console.error("Failed to extract PDF text on server:", err);
    if (err instanceof Error) {
      console.error("Error Stack:", err.stack);
    }
    return "";
  }
}
