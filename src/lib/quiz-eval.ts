/**
 * Utility functions for quiz question parsing, option cleaning,
 * and robust answer evaluation (handling LLM format variations).
 */

/**
 * Strip prefix like "a. ", "a) ", "A. ", "1. ", "1) " from option text.
 */
export function cleanOptionText(text: string): string {
  if (!text) return "";
  return text.trim().replace(/^([a-dA-D1-4])[.):\s]\s*/, "");
}

/**
 * Return uppercase option letter badge 'A', 'B', 'C', 'D' for index 0, 1, 2, 3
 */
export function getOptionLetterUpper(index: number): string {
  return String.fromCharCode(65 + index);
}

/**
 * Robustly evaluate whether a user's selected MCQ answer matches the correct answer,
 * taking into account possible LLM output quirks (letter prefixes, full text, case differences, etc.).
 */
export function checkMcqCorrect(
  userAns: string,
  correctAns: string,
  options: string[] = [],
): boolean {
  if (!userAns || !correctAns) return false;

  const rawUser = userAns.trim();
  const rawCorrect = correctAns.trim();

  // 1. Direct equality check
  if (rawUser === rawCorrect) return true;

  // 2. Normalized lowercase check
  const normUser = rawUser.toLowerCase();
  const normCorrect = rawCorrect.toLowerCase();
  if (normUser === normCorrect) return true;

  // Helper to extract option letter and cleaned text body
  const parseStr = (s: string) => {
    const match = s.trim().match(/^([a-d])[.):\s]\s*(.*)$/i);
    if (match) {
      return { letter: match[1]!.toLowerCase(), body: match[2]!.trim().toLowerCase() };
    }
    return { letter: null, body: s.trim().toLowerCase() };
  };

  const uParsed = parseStr(rawUser);
  const cParsed = parseStr(rawCorrect);

  // 3. Letter match (e.g. correct_answer is "b" or "b." and user selection has letter "b")
  if (uParsed.letter && cParsed.letter && uParsed.letter === cParsed.letter) {
    return true;
  }
  if (uParsed.letter && normCorrect === uParsed.letter) {
    return true;
  }
  if (cParsed.letter && normUser === cParsed.letter) {
    return true;
  }

  // 4. Cleaned body match
  const cleanUser = cleanOptionText(rawUser).toLowerCase();
  const cleanCorrect = cleanOptionText(rawCorrect).toLowerCase();
  if (cleanUser && cleanCorrect && cleanUser === cleanCorrect) {
    return true;
  }

  // 5. Options array index match
  if (options.length > 0) {
    const userIdx = options.findIndex(
      (opt) => opt.trim() === rawUser || opt.trim().toLowerCase() === normUser,
    );

    let correctIdx = options.findIndex((opt) => {
      const optClean = cleanOptionText(opt).toLowerCase();
      const optNorm = opt.trim().toLowerCase();
      return (
        optNorm === normCorrect ||
        optClean === cleanCorrect ||
        (cParsed.letter !== null && parseStr(opt).letter === cParsed.letter)
      );
    });

    if (correctIdx === -1) {
      if (normCorrect === "a" || normCorrect === "0" || normCorrect === "a.") correctIdx = 0;
      else if (normCorrect === "b" || normCorrect === "1" || normCorrect === "b.") correctIdx = 1;
      else if (normCorrect === "c" || normCorrect === "2" || normCorrect === "c.") correctIdx = 2;
      else if (normCorrect === "d" || normCorrect === "3" || normCorrect === "d.") correctIdx = 3;
    }

    if (userIdx !== -1 && userIdx === correctIdx) {
      return true;
    }
  }

  // 6. Substring inclusion check for minor punctuation or spacing differences
  if (cleanUser.length > 3 && cleanCorrect.length > 3) {
    if (cleanUser.includes(cleanCorrect) || cleanCorrect.includes(cleanUser)) {
      return true;
    }
  }

  return false;
}
