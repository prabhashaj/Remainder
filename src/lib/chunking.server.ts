/**
 * A simple utility to chunk text into smaller, overlapping segments.
 *
 * @param text The full text to chunk
 * @param chunkSize The maximum size of each chunk (in characters)
 * @param overlap The number of characters to overlap between chunks
 * @returns Array of text chunks
 */
export function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  if (!text) return [];

  // Normalize whitespace somewhat
  const normalizedText = text.replace(/\r\n/g, "\n");
  const chunks: string[] = [];

  let startIndex = 0;
  while (startIndex < normalizedText.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex >= normalizedText.length) {
      // Last chunk
      chunks.push(normalizedText.slice(startIndex));
      break;
    }

    // Try to find a logical break point (double newline, single newline, period, space)
    // within the last 20% of the chunk size to avoid cutting words in half
    const searchArea = normalizedText.slice(
      Math.max(startIndex + chunkSize * 0.8, startIndex),
      endIndex,
    );
    
    let breakIndex = -1;

    // Prefer paragraph breaks
    const doubleNewline = searchArea.lastIndexOf("\n\n");
    if (doubleNewline !== -1) {
      breakIndex = endIndex - searchArea.length + doubleNewline + 2;
    } else {
      // Fallback to sentence breaks
      const singleNewline = searchArea.lastIndexOf("\n");
      const period = searchArea.lastIndexOf(". ");

      if (singleNewline !== -1) {
        breakIndex = endIndex - searchArea.length + singleNewline + 1;
      } else if (period !== -1) {
        breakIndex = endIndex - searchArea.length + period + 2;
      } else {
        // Fallback to word breaks
        const space = searchArea.lastIndexOf(" ");
        if (space !== -1) {
          breakIndex = endIndex - searchArea.length + space + 1;
        }
      }
    }

    if (breakIndex !== -1 && breakIndex > startIndex) {
      endIndex = breakIndex;
    }

    chunks.push(normalizedText.slice(startIndex, endIndex).trim());

    // Move start index forward, accounting for overlap
    startIndex = endIndex - overlap;
    
    // Ensure we always move forward
    if (startIndex <= 0 || endIndex - startIndex <= 0) {
       startIndex = endIndex;
    }
  }

  // Filter out any empty chunks that might have been created
  return chunks.filter((c) => c.length > 0);
}
