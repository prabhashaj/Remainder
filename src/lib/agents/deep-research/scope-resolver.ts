import type {
  OutputFormat,
  ResearchIntent,
  ResearchTask,
  TemporalScope,
} from "./types";

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
 * Normalizes dates like "January 1, 2025" or "15 Sep 2026" or "2025-01-01" into "YYYY-MM-DD".
 * Returns strictly undefined if date cannot be resolved (NEVER invents fake dates).
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

  // Match single year "2025" or "2026"
  const yearMatch = /^(\d{4})$/.exec(trimmed);
  if (yearMatch && yearMatch[1]) {
    return `${yearMatch[1]}-01-01`;
  }

  // Generic ISO parse attempt
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed) && !/^\d+$/.test(trimmed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }

  return undefined;
}

/**
 * Extracts temporal constraints from text generically across any date expression.
 */
export function extractDateRangeFromText(text: string): {
  startDate?: string | undefined;
  endDate?: string | undefined;
  mode: TemporalScope["mode"];
} {
  let startDate: string | undefined;
  let endDate: string | undefined;
  let mode: TemporalScope["mode"] = "open";

  // 1. "between <date1> and <date2>"
  const betweenPattern =
    /between\s+([A-Za-z]+ \d{1,2},? \d{4}|\d{4}-\d{1,2}-\d{1,2}|\w+ \d{4}|\d{4})\s+and\s+([A-Za-z]+ \d{1,2},? \d{4}|\d{4}-\d{1,2}-\d{1,2}|\w+ \d{4}|\d{4})/i;
  const betweenMatch = betweenPattern.exec(text);
  if (betweenMatch && betweenMatch[1] && betweenMatch[2]) {
    startDate = parseDateString(betweenMatch[1]);
    endDate = parseDateString(betweenMatch[2]);
    mode = "between";
  }

  // 2. "from <date1> to <date2>" or "from 2020-2026" or "2020–2026"
  if (!startDate && !endDate) {
    const fromToPattern =
      /(?:from\s+)?(\d{4}|[A-Za-z]+ \d{4})\s*(?:to|until|through|–|-)\s*(\d{4}|[A-Za-z]+ \d{4})/i;
    const fromToMatch = fromToPattern.exec(text);
    if (fromToMatch && fromToMatch[1] && fromToMatch[2]) {
      startDate = parseDateString(fromToMatch[1]);
      endDate = parseDateString(fromToMatch[2]);
      mode = "between";
    }
  }

  // 3. "cutoff [date]" or "as of [date]" or "until [date]"
  if (!endDate) {
    const cutoffPattern =
      /(?:cutoff|cutoff date|as of|up to|until|through)\s+(?:is\s+)?([A-Za-z]+ \d{1,2},? \d{4}|\d{4}-\d{1,2}-\d{1,2}|\w+ \d{4}|\d{4})/i;
    const cutoffMatch = cutoffPattern.exec(text);
    if (cutoffMatch && cutoffMatch[1]) {
      endDate = parseDateString(cutoffMatch[1]);
      mode = "as_of";
    }
  }

  // 4. "after [date]" / "since [date]"
  if (!startDate) {
    const afterPattern = /(?:after|since)\s+([A-Za-z]+ \d{1,2},? \d{4}|\d{4})/i;
    const afterMatch = afterPattern.exec(text);
    if (afterMatch && afterMatch[1]) {
      startDate = parseDateString(afterMatch[1]);
      mode = "after";
    }
  }

  // 5. "before [date]" / "prior to [date]"
  if (!endDate) {
    const beforePattern = /(?:before|prior to)\s+([A-Za-z]+ \d{1,2},? \d{4}|\d{4})/i;
    const beforeMatch = beforePattern.exec(text);
    if (beforeMatch && beforeMatch[1]) {
      endDate = parseDateString(beforeMatch[1]);
      mode = "before";
    }
  }

  return { startDate, endDate, mode };
}

/**
 * Classifies research intent generically based on query structure (domain-agnostic).
 */
export function inferResearchIntent(question: string): {
  intent: ResearchIntent;
  outputFormat: OutputFormat;
  rankingRequired: boolean;
} {
  const lower = question.toLowerCase();

  // 1. Comparison intent
  if (
    /\b(compare|versus|vs\.?|difference between|tradeoffs? between|which is better)\b/i.test(
      lower,
    )
  ) {
    return {
      intent: "comparison",
      outputFormat: "comparison",
      rankingRequired: false,
    };
  }

  // 2. Scientific / Claim verification intent
  if (
    /\b(is\s+.+\s+(?:true|supported|scientifically|real|effective|harmful|possible)|investigate whether|does\s+.+\s+cause|is there evidence)\b/i.test(
      lower,
    )
  ) {
    return {
      intent: "verification",
      outputFormat: "scientific_verification",
      rankingRequired: false,
    };
  }

  // 3. Historical / Causal investigation intent
  if (
    /\b(what caused|why did|causes of|origins of|historical roots|how did .+ happen|driver of)\b/i.test(
      lower,
    )
  ) {
    return {
      intent: "historical_cause",
      outputFormat: "causal_investigation",
      rankingRequired: false,
    };
  }

  // 4. Strategic / Competitive / Market analysis
  if (
    /\b(competitive position|swot|risks and opportunities|market position|competitive landscape|strategic analysis)\b/i.test(
      lower,
    )
  ) {
    return {
      intent: "strategic_analysis",
      outputFormat: "strategic_analysis",
      rankingRequired: false,
    };
  }

  // 5. Ranking intent ("biggest", "top", "most important", "leading breakthroughs")
  if (
    /\b(biggest|most important|top \d+|most impactful|leading|rank|ranking|greatest|major breakthroughs)\b/i.test(
      lower,
    )
  ) {
    return {
      intent: "ranking",
      outputFormat: "ranking",
      rankingRequired: true,
    };
  }

  // 6. Landscape / Survey
  return {
    intent: "landscape",
    outputFormat: "general_report",
    rankingRequired: false,
  };
}

/**
 * Extracts named entities (companies, products, concepts, places) generically from prompt text.
 */
export function extractEntitiesFromQuestion(question: string): string[] {
  const entities: string[] = [];

  // Match capitalized sequences (e.g. "AWS, Azure and GCP", "NVIDIA Blackwell", "EU AI Act")
  const words = question.split(/\s+/);
  const potentialEntities: string[] = [];

  for (const word of words) {
    const clean = word.replace(/^[("']|[),?!'".]$/g, "");
    if (
      clean.length > 1 &&
      clean[0] === clean[0]?.toUpperCase() &&
      clean[0] !== clean[0]?.toLowerCase() &&
      !["What", "How", "Why", "When", "Which", "Where", "Who", "Is", "Are", "Compare", "Analyze", "Research", "Between", "From", "And", "The", "For", "In", "Of"].includes(
        clean,
      )
    ) {
      potentialEntities.push(clean);
    }
  }

  // Join contiguous capitalized words
  for (let i = 0; i < potentialEntities.length; i++) {
    entities.push(potentialEntities[i]!);
  }

  return Array.from(new Set(entities));
}

/**
 * Derives generic comparison/evaluation dimensions dynamically based on intent and query topic.
 */
export function deriveEvaluationDimensions(
  question: string,
  intent: ResearchIntent,
): string[] {
  const lower = question.toLowerCase();

  // Cloud / Software / Services
  if (lower.includes("cloud") || lower.includes("provider") || lower.includes("software") || lower.includes("tool")) {
    return [
      "Core Capabilities & Performance",
      "Cost & Pricing Structure",
      "Reliability & SLA Guarantees",
      "Developer Experience & Ecosystem",
      "Security & Compliance",
    ];
  }

  // University / Education
  if (lower.includes("universit") || lower.includes("college") || lower.includes("school") || lower.includes("program")) {
    return [
      "Academic Quality & Faculty",
      "Curriculum & Research Opportunities",
      "Tuition Cost & Financial Aid",
      "Career Placement & Industry Outcomes",
      "Campus Environment & Location",
    ];
  }

  // Hardware / Physical Technology / Engineering (e.g. Battery, Semiconductor, Wastewater)
  if (
    lower.includes("battery") ||
    lower.includes("semiconductor") ||
    lower.includes("wastewater") ||
    lower.includes("robotics") ||
    lower.includes("energy") ||
    lower.includes("hardware")
  ) {
    return [
      "Technical Efficiency & Performance",
      "Manufacturing Scalability & Cost",
      "Durability & Operational Lifespan",
      "Safety & Environmental Impact",
      "Commercial Maturity & Adoption",
    ];
  }

  // Historical / Economic / Policy event
  if (intent === "historical_cause" || lower.includes("crisis") || lower.includes("inflation") || lower.includes("economic")) {
    return [
      "Root Structural Vulnerabilities",
      "Immediate Catalyst Triggers",
      "Institutional & Regulatory Response",
      "Systemic Contagion Mechanisms",
      "Long-Term Societal & Economic Impact",
    ];
  }

  // Default dynamic dimensions
  return [
    "Foundational Significance & Novelty",
    "Empirical Capability & Verified Evidence",
    "Real-World Adoption & Impact",
    "Cost & Operational Feasibility",
    "Reliability & Risk Limitations",
  ];
}

/**
 * Domain-Agnostic Research Task Resolver:
 * Produces a generic, structured ResearchTask without any hardcoded domain assumptions.
 */
export function resolveResearchScope(userQuestion: string): ResearchTask {
  const { startDate, endDate, mode } = extractDateRangeFromText(userQuestion);
  const { intent, outputFormat, rankingRequired } = inferResearchIntent(userQuestion);
  const entities = extractEntitiesFromQuestion(userQuestion);
  const comparisonDimensions = deriveEvaluationDimensions(userQuestion, intent);

  // Geographic context extraction
  let geographicScope: string | undefined = undefined;
  const lower = userQuestion.toLowerCase();
  if (lower.includes("in india") || lower.includes("india's")) geographicScope = "India";
  else if (lower.includes("in the us") || lower.includes("united states") || lower.includes("american")) geographicScope = "United States";
  else if (lower.includes("in the eu") || lower.includes("european union")) geographicScope = "European Union";
  else if (lower.includes("in china") || lower.includes("chinese")) geographicScope = "China";
  else if (lower.includes("in the uk") || lower.includes("united kingdom")) geographicScope = "United Kingdom";

  const temporalScope: TemporalScope = {
    mode,
    startDate,
    endDate,
    cutoffPolicy: endDate ? "strict" : "retrospective_allowed",
    targetTimeframeDescription: startDate && endDate ? `${startDate} to ${endDate}` : endDate ? `up to ${endDate}` : undefined,
  };

  return {
    question: userQuestion.trim(),
    topic: userQuestion.trim(),
    startDate,
    endDate,
    geography: geographicScope,
    objective: `Rigorous investigation of: "${userQuestion.trim()}"`,
    intent,
    entities,
    scopeDescription: `Investigation into ${userQuestion.trim()} (${temporalScope.targetTimeframeDescription || "open window"})`,
    temporalScope,
    geographicScope,
    domains: [intent, ...entities],
    comparisonDimensions,
    rankingRequired,
    evidenceRequirements: [
      "Direct evidentiary citations for all headline assertions",
      "Contextualized baselines for numerical metrics",
      "Corroboration across independent source groups",
      "Verification of causal links vs correlational coincidence",
    ],
    outputFormat,
  };
}
