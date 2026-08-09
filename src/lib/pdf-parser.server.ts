export async function extractPdfTextServer(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import legacy build of pdfjs-dist for Node environment compatibility
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
    const pdf = await loadingTask.promise;

    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageText = content.items.map((item: any) => item.str ?? "").join(" ");
      if (pageText.trim()) {
        fullText += `--- page ${i} ---\n${pageText.trim()}\n\n`;
      }
    }
    return fullText.trim();
  } catch (err) {
    console.error("Failed to extract PDF text on server:", err);
    return "";
  }
}
