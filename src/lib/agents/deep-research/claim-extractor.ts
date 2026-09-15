import type {
  AtomicClaim,
  CausalClassification,
  CausalValidation,
  ClaimType,
  DateClassification,
  QuantitativeData,
} from "./types";
import { extractDateClassification } from "./temporal-validator";

const STRONG_CAUSAL_VERBS = [
  "caused",
  "causes",
  "enabled",
  "enables",
  "resulted in",
  "results in",
  "drove",
  "drives",
  "accelerated",
  "accelerates",
  "led to",
  "leads to",
  "induced",
  "induces",
  "produced",
  "produces",
  "triggered",
  "triggers",
  "forced",
  "forces",
  "created",
];

const MECHANISTIC_VERBS = [
  "catalyzes",
  "chemically reacts",
  "degrades",
  "oxidizes",
  "binds to",
  "synthesizes",
  "converts",
  "transfers",
  "encodes",
  "computes",
  "modulates",
  "inhibits",
];

const WEAKENED_CAUSAL_MAP: Record<string, string> = {
  caused: "likely contributed to",
  causes: "likely contributes to",
  enabled: "was compatible with and facilitated",
  enables: "is compatible with and facilitates",
  "resulted in": "coincided with and influenced",
  "results in": "coincides with and influences",
  drove: "helped stimulate",
  drives: "helps stimulate",
  accelerated: "coincided with an acceleration in",
  accelerates: "coincides with an acceleration in",
  "led to": "correlated with",
  "leads to": "correlates with",
  induced: "was associated with",
  induces: "is associated with",
  triggered: "preceded",
  triggers: "precedes",
};

/**
 * Domain-agnostic quantitative data extractor:
 * Handles percentages, multipliers, currencies, scientific units, rates, counts, and baselines.
 */
export function extractNumericalData(claimText: string): QuantitativeData | undefined {
  const text = claimText.trim();

  // 1. Percentage: e.g. "30% faster", "40% reduction", "rose 6.5%", "15.2% margin"
  const percentMatch =
    /(\d+(?:\.\d+)?)\s*%\s*(faster|slower|cheaper|reduction|gain|increase|decrease|improvement|higher|lower|growth|inflation|rate)?/i.exec(
      text,
    );
  if (percentMatch && percentMatch[1]) {
    const rawNum = parseFloat(percentMatch[1]);
    const comparison = percentMatch[2] || "% change";
    const direction =
      /faster|gain|increase|improvement|higher|growth/i.test(comparison) || /rose|increased|grew|surged/i.test(text)
        ? "increase"
        : /slower|cheaper|reduction|decrease|lower|fell|dropped/i.test(comparison) || /fell|decreased|dropped/i.test(text)
          ? "decrease"
          : "neutral";

    const rawStr = `${percentMatch[1]}%`;
    const conditions = extractMeasurementConditions(text);
    return {
      value: rawStr,
      rawValue: rawStr,
      numericValue: rawNum,
      unit: "%",
      category: "percentage",
      direction,
      comparison,
      baseline: extractBaseline(text),
      conditions,
      measurementConditions: conditions,
      isBestCaseOnly: isBestCase(text),
    };
  }

  // 2. Multiplier: e.g. "2x faster", "3x throughput", "10-fold increase"
  const multMatch =
    /(\d+(?:\.\d+)?)\s*(?:[xX]|-fold)\s*(faster|slower|throughput|speedup|latency|improvement|reduction|cheaper|increase)?/i.exec(
      text,
    );
  if (multMatch && multMatch[1]) {
    const rawNum = parseFloat(multMatch[1]);
    const comparison = multMatch[2] || "multiplier speedup";
    const rawStr = `${multMatch[1]}x`;
    return {
      value: rawStr,
      rawValue: rawStr,
      numericValue: rawNum,
      unit: "multiplier",
      category: "multiplier",
      direction: /slower|cheaper|reduction/i.test(comparison) ? "decrease" : "increase",
      comparison,
      baseline: extractBaseline(text),
      conditions: extractMeasurementConditions(text),
      isBestCaseOnly: isBestCase(text),
    };
  }

  // 3. Currency: e.g. "$700 billion", "$50B", "€120 million", "₹15,000 crore", "10 billion USD"
  const currencyMatch =
    /(?:\$|€|£|¥|₹)\s*(\d+(?:[.,]\d+)?)\s*(trillion|billion|million|crore|lakh|k|b|m)?\b/i.exec(
      text,
    ) ||
    /(\d+(?:[.,]\d+)?)\s*(trillion|billion|million|crore|lakh)?\s*(?:USD|EUR|GBP|INR|JPY|dollars)/i.exec(
      text,
    );

  if (currencyMatch && currencyMatch[1]) {
    const cleanNum = parseFloat(currencyMatch[1].replace(/,/g, ""));
    const magnitude = currencyMatch[2]?.toLowerCase() || "";
    let mult = 1;
    if (magnitude === "billion" || magnitude === "b") mult = 1e9;
    else if (magnitude === "million" || magnitude === "m") mult = 1e6;
    else if (magnitude === "trillion") mult = 1e12;
    else if (magnitude === "crore") mult = 1e7;
    else if (magnitude === "lakh") mult = 1e5;

    const rawStr = currencyMatch[0].trim();
    return {
      value: rawStr,
      rawValue: rawStr,
      numericValue: cleanNum * mult,
      unit: "currency",
      category: "currency",
      baseline: extractBaseline(text),
      conditions: extractMeasurementConditions(text),
    };
  }

  // 4. Physical / Scientific Units (Domain-Agnostic: battery, chemical, hardware, energy)
  // e.g. "450 Wh/kg", "300 mg/L", "50 GW", "100 MW", "20 ms", "1.8 TB/s", "500B params"
  const unitMatch =
    /(\d+(?:\.\d+)?)\s*(Wh\/kg|mAh\/g|mg\/L|ppm|GW|MW|kW|kWh|MWh|TB\/s|GB\/s|ms|tokens\/s|tok\/s|flops|tflops|pflops|parameters|params|weights|bps|students|users|subscribers)\b/i.exec(
      text,
    );
  if (unitMatch && unitMatch[1] && unitMatch[2]) {
    const rawNum = parseFloat(unitMatch[1]);
    const unit = unitMatch[2];
    const isCount = /parameters|params|weights|students|users|subscribers/i.test(unit);
    const isRate = /tokens\/s|tok\/s|TB\/s|GB\/s|bps/i.test(unit);
    const rawStr = `${unitMatch[1]} ${unit}`;

    return {
      value: rawStr,
      rawValue: rawStr,
      numericValue: rawNum,
      unit,
      category: isCount ? "count" : isRate ? "rate" : "dimension",
      baseline: extractBaseline(text),
      conditions: extractMeasurementConditions(text),
      isBestCaseOnly: isBestCase(text),
    };
  }

  return undefined;
}

/**
 * Extracts comparison baseline generically (e.g. "than X", "versus Y", "compared to 260 Wh/kg for standard lithium cells")
 */
function extractBaseline(text: string): string | undefined {
  // Check if comparison has metric + entity: e.g. "compared to 260 Wh/kg for standard lithium cells"
  const metricForMatch =
    /(?:than|compared to|relative to|versus|vs\.?)\s+\d+(?:\.\d+)?\s*\S+\s+(?:for|in|of|on)\s+([^,.]+)/i.exec(
      text,
    );
  if (metricForMatch && metricForMatch[1]) {
    return metricForMatch[1].trim();
  }

  // Look for "than X", "compared to X", "relative to X", "over X", "versus X", "vs X"
  const baselineMatch =
    /(?:than|compared to|relative to|over|versus|vs\.?|from)\s+([^,.]+)/i.exec(
      text,
    );
  if (baselineMatch && baselineMatch[1]) {
    const candidate = baselineMatch[1]
      .trim()
      .split(/\s+(?:under|at|on|measured|with|in)\s+/i)[0]
      ?.trim();
    if (
      candidate &&
      !["the", "an", "a", "its", "previous", "other"].includes(candidate.toLowerCase())
    ) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Extracts measurement / benchmark conditions generically
 */
function extractMeasurementConditions(text: string): string | undefined {
  const condMatch =
    /(?:on|under|measured on|evaluated on|using|tested at|tested on|in)\s+((?:[A-Za-z0-9_.\-]+(?:\s+[A-Za-z0-9_.\-]+){0,4}))/i.exec(
      text,
    );
  if (condMatch && condMatch[1]) {
    const val = condMatch[1].trim();
    if (val.length > 2 && !["the", "an", "a", "this", "that"].includes(val.toLowerCase())) {
      return val;
    }
  }
  return undefined;
}

function isBestCase(text: string): boolean {
  return /up to|best-case|peak|isolated|under optimal conditions|ideal conditions/i.test(text);
}

/**
 * Validates causal statements generically:
 * Distinguishes CORRELATION, CAUSATION, MECHANISTIC, TEMPORAL_SEQUENCE, and SPECULATION.
 */
export function validateCausalStatement(
  statement: string,
  hasDirectCausalEvidence: boolean,
): CausalValidation {
  const lower = statement.toLowerCase();
  const foundVerbs: string[] = [];

  // Check for speculative hedging
  if (/\b(might have|could potentially|may have been|possibly|speculated to)\b/i.test(lower)) {
    return {
      isCausalClaim: true,
      classification: "SPECULATION",
      causalVerbsFound: [],
      supportedByDirectEvidence: false,
      suggestedWording: statement,
    };
  }

  // Check for mechanistic descriptions
  for (const mv of MECHANISTIC_VERBS) {
    if (new RegExp(`\\b${mv}\\b`, "i").test(lower)) {
      return {
        isCausalClaim: true,
        classification: "MECHANISTIC",
        causalVerbsFound: [mv],
        supportedByDirectEvidence: true,
        suggestedWording: statement,
      };
    }
  }

  // Check for strong causal verbs
  for (const verb of STRONG_CAUSAL_VERBS) {
    if (new RegExp(`\\b${verb}\\b`, "i").test(lower)) {
      foundVerbs.push(verb);
    }
  }

  if (foundVerbs.length === 0) {
    // Check if temporal sequence is asserted without causal verbs
    if (/\b(followed by|subsequently|prior to which|after which)\b/i.test(lower)) {
      return {
        isCausalClaim: false,
        classification: "TEMPORAL_SEQUENCE",
        causalVerbsFound: [],
        supportedByDirectEvidence: true,
      };
    }

    return {
      isCausalClaim: false,
      classification: "CORRELATION",
      causalVerbsFound: [],
      supportedByDirectEvidence: true,
    };
  }

  if (hasDirectCausalEvidence) {
    return {
      isCausalClaim: true,
      classification: "CAUSATION",
      causalVerbsFound: foundVerbs,
      supportedByDirectEvidence: true,
      suggestedWording: statement,
    };
  }

  // Rewrite causal verbs into correlational wording
  let weakened = statement;
  for (const verb of foundVerbs) {
    const replacement = WEAKENED_CAUSAL_MAP[verb.toLowerCase()] || "was associated with";
    const regex = new RegExp(`\\b${verb}\\b`, "gi");
    weakened = weakened.replace(regex, replacement);
  }

  return {
    isCausalClaim: true,
    classification: "CORRELATION",
    causalVerbsFound: foundVerbs,
    supportedByDirectEvidence: false,
    suggestedWording: weakened,
  };
}

/**
 * Classifies claim type: Fact vs Interpretation vs Inference vs Forecast vs Opinion
 */
export function classifyClaimType(statement: string): ClaimType {
  const lower = statement.toLowerCase();

  // 1. Forecast indicators
  if (
    /\b(will|projected to|forecast|expected to|anticipated|by \d{4}|future|may eventually|outlook)\b/i.test(
      lower,
    )
  ) {
    return "forecast";
  }

  // 2. Opinion indicators
  if (
    /\b(in our view|we believe|arguably|best|worst|superior|disappointing|impressive|preferred)\b/i.test(
      lower,
    )
  ) {
    return "opinion";
  }

  // 3. Inference / Deductive indicators
  if (
    /\b(therefore|consequently|implies that|it follows that|must be|deduced from)\b/i.test(
      lower,
    )
  ) {
    return "inference";
  }

  // 4. Interpretation / Analysis indicators
  if (
    /\b(suggests|indicates|demonstrates potential|likely reflects|appears to|can be interpreted)\b/i.test(
      lower,
    )
  ) {
    return "interpretation";
  }

  return "fact";
}

/**
 * Splits compound sentences into atomic claims.
 */
export function splitIntoAtomicClaims(
  text: string,
  sourceDate?: string,
): AtomicClaim[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const claims: AtomicClaim[] = [];
  let counter = 1;

  for (const sentence of sentences) {
    const clauses = splitCompoundSentence(sentence);

    for (const clause of clauses) {
      const dates: DateClassification = extractDateClassification(clause, sourceDate);
      const numerical = extractNumericalData(clause);
      const causal = validateCausalStatement(clause, false);
      const claimType = classifyClaimType(clause);

      claims.push({
        id: `claim_${counter++}`,
        claim: clause,
        claimType,
        dates,
        quantitative: numerical,
        numerical,
        causal,
      });
    }
  }

  return claims;
}

/**
 * Splits compound sentences joined by coordinates with distinct assertions
 */
function splitCompoundSentence(sentence: string): string[] {
  // Check coordinate clauses like "released X, and is 40% cheaper and 2x faster"
  const commaAndRegex = /(.*?(?:released|announced|launched|introduced|developed|established)[^,]*?),\s*(?:and\s+)?(is\s+.*|\d+.*)/i;
  const match = commaAndRegex.exec(sentence);
  if (match && match[1] && match[2]) {
    const part1 = match[1].trim();
    const part2 = match[2].trim();

    const subParts = part2.split(/\s+and\s+(?=\d|is\s+|\w+\s+is)/i);
    return [part1, ...subParts.map((sp) => sp.trim())];
  }

  return [sentence];
}
