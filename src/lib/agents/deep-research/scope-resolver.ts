import type { ResearchScope } from "./types";

const MONTH_MAP: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  sept: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/**
 * Normalizes dates like "January 1, 2025" or "15 Sep 2026" or "2025-01-01" into "YYYY-MM-DD"
 */
export function parseDateString(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  const trimmed = dateStr.trim();

  // Match ISO YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3]) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, "0");
    const day = isoMatch[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Match "January 1, 2025" or "September 15, 2026"
  const mdyMatch =
    /([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i.exec(trimmed);
  if (mdyMatch && mdyMatch[1] && mdyMatch[2] && mdyMatch[3]) {
    const monthKey = mdyMatch[1].toLowerCase();
    const month = MONTH_MAP[monthKey];
    if (month) {
      const day = mdyMatch[2].padStart(2, "0");
      const year = mdyMatch[3];
      return `${year}-${month}-${day}`;
    }
  }

  // Match "15 September 2026"
  const dmyMatch =
    /(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})/i.exec(trimmed);
  if (dmyMatch && dmyMatch[1] && dmyMatch[2] && dmyMatch[3]) {
    const monthKey = dmyMatch[2].toLowerCase();
    const month = MONTH_MAP[monthKey];
    if (month) {
      const day = dmyMatch[1].padStart(2, "0");
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }
  }

  // Match single year "2025"
  const yearMatch = /^(\d{4})$/.exec(trimmed);
  if (yearMatch && yearMatch[1]) {
    return `${yearMatch[1]}-01-01`;
  }

  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }

  return undefined;
}

/**
 * Extracts start and end dates from query text such as:
 * "between January 1, 2025 and September 15, 2026"
 * "from 2025 to 2026"
 * "cutoff September 15, 2026"
 */
export function extractDateRangeFromText(text: string): {
  startDate?: string | undefined;
  endDate?: string | undefined;
} {
  let startDate: string | undefined;
  let endDate: string | undefined;

  // Pattern: "between <date1> and <date2>"
  const betweenPattern =
    /between\s+([A-Za-z]+ \d{1,2},? \d{4}|\d{4}-\d{1,2}-\d{1,2}|\w+ \d{4})\s+and\s+([A-Za-z]+ \d{1,2},? \d{4}|\d{4}-\d{1,2}-\d{1,2}|\w+ \d{4})/i;
  const betweenMatch = betweenPattern.exec(text);
  if (betweenMatch && betweenMatch[1] && betweenMatch[2]) {
    startDate = parseDateString(betweenMatch[1]);
    endDate = parseDateString(betweenMatch[2]);
  }

  // Pattern: "from <date1> to <date2>"
  if (!startDate && !endDate) {
    const fromToPattern =
      /from\s+([A-Za-z]+ \d{1,2},? \d{4}|\d{4}-\d{1,2}-\d{1,2}|\w+ \d{4})\s+(?:to|until|through)\s+([A-Za-z]+ \d{1,2},? \d{4}|\d{4}-\d{1,2}-\d{1,2}|\w+ \d{4})/i;
    const fromToMatch = fromToPattern.exec(text);
    if (fromToMatch && fromToMatch[1] && fromToMatch[2]) {
      startDate = parseDateString(fromToMatch[1]);
      endDate = parseDateString(fromToMatch[2]);
    }
  }

  // Pattern: "cutoff (is|of|date)? <date>" or "as of <date>"
  if (!endDate) {
    const cutoffPattern =
      /(?:cutoff|cutoff date|as of|up to|until)\s+(?:is\s+)?([A-Za-z]+ \d{1,2},? \d{4}|\d{4}-\d{1,2}-\d{1,2})/i;
    const cutoffMatch = cutoffPattern.exec(text);
    if (cutoffMatch && cutoffMatch[1]) {
      endDate = parseDateString(cutoffMatch[1]);
    }
  }

  return { startDate, endDate };
}

/**
 * Programmatic Scope Resolver:
 * Takes the user question and builds a strictly defined ResearchScope.
 */
export function resolveResearchScope(userQuestion: string): ResearchScope {
  const { startDate, endDate } = extractDateRangeFromText(userQuestion);

  // Check ranking requirement
  const rankingWords = [
    "biggest",
    "most impactful",
    "top",
    "rank",
    "ranking",
    "best",
    "leading",
    "most important",
    "major upgrades",
    "breakthroughs",
  ];
  const lowerQ = userQuestion.toLowerCase();
  const rankingRequired = rankingWords.some((word) => lowerQ.includes(word));

  // Determine domains relevant to the prompt
  const domainCandidates: Array<{ domain: string; keywords: string[] }> = [
    {
      domain: "Model Architectures",
      keywords: ["model", "llm", "moe", "reasoning", "diffusion", "weights", "compression"],
    },
    {
      domain: "Agents",
      keywords: ["agent", "tool use", "planning", "computer-use", "multi-agent", "coding agent"],
    },
    {
      domain: "Generative AI & Multimodal",
      keywords: ["image", "video", "multimodal", "audio", "speech", "generative", "world model"],
    },
    {
      domain: "Robotics & Embodied AI",
      keywords: ["robot", "vla", "embodied", "humanoid", "actuator"],
    },
    {
      domain: "Infrastructure & Hardware",
      keywords: ["gpu", "tpu", "inference", "quantization", "kv-cache", "latency", "memory", "bandwidth"],
    },
    {
      domain: "Training & Post-Training",
      keywords: ["training", "rl", "post-training", "synthetic data", "rlhf", "rlaif"],
    },
    {
      domain: "Safety & Evaluations",
      keywords: ["safety", "eval", "jailbreak", "interpretability", "alignment", "red-team"],
    },
    {
      domain: "Regulation & Policy",
      keywords: ["regulation", "policy", "act", "law", "compliance", "copyright"],
    },
    {
      domain: "Commercialization & Industry Adoption",
      keywords: ["commercial", "enterprise", "api", "pricing", "adoption", "market"],
    },
  ];

  const matchedDomains = domainCandidates
    .filter((dc) => dc.keywords.some((k) => lowerQ.includes(k)))
    .map((dc) => dc.domain);

  // If AI topic or broad question, supply full landscape domains
  const finalDomains =
    matchedDomains.length >= 3
      ? matchedDomains
      : domainCandidates.map((dc) => dc.domain);

  // Detect geography if mentioned
  let geography = "Global";
  if (lowerQ.includes("united states") || lowerQ.includes("us ") || lowerQ.includes("in the us")) {
    geography = "United States";
  } else if (lowerQ.includes("european union") || lowerQ.includes("eu ")) {
    geography = "European Union";
  } else if (lowerQ.includes("china")) {
    geography = "China";
  }

  return {
    topic: userQuestion.trim(),
    startDate,
    endDate,
    geography,
    domains: finalDomains,
    researchQuestion: userQuestion.trim(),
    rankingRequired,
  };
}
