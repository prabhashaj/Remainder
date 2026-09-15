import type {
  AtomicClaim,
  CausalValidation,
  ClaimType,
  DateClassification,
  NumericalData,
} from "./types";
import { extractDateClassification } from "./temporal-validator";

const CAUSAL_VERBS = [
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
  "produced",
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
  "led to": "correlated with",
  "leads to": "correlates with",
};

/**
 * Detects numerical claims in text (e.g. %, x faster, parameters, latency, bandwidth, FLOPs)
 */
export function extractNumericalData(claimText: string): NumericalData | undefined {
  // 1. Percentage improvement: e.g. "30% faster", "40% reduction", "15% improvement"
  const percentMatch =
    /(\d+(?:\.\d+)?)\s*%\s*(faster|slower|cheaper|reduction|gain|increase|decrease|improvement|higher|lower)?/i.exec(
      claimText,
    );
  if (percentMatch && percentMatch[1]) {
    const value = percentMatch[1];
    const comparison = percentMatch[2] || "% change";
    const baseline = extractBaseline(claimText);
    const measurementConditions = extractMeasurementConditions(claimText);
    return {
      value: `${value}%`,
      unit: "%",
      comparison,
      baseline,
      measurementConditions,
      isBestCaseOnly: isBestCase(claimText),
    };
  }

  // 2. Multiplier: e.g. "2x faster", "3x throughput", "10x lower latency"
  const multMatch =
    /(\d+(?:\.\d+)?)\s*[xX]\s*(faster|slower|throughput|speedup|latency|improvement|reduction|cheaper)?/i.exec(
      claimText,
    );
  if (multMatch && multMatch[1]) {
    const value = multMatch[1];
    const comparison = multMatch[2] || "multiplier speedup";
    const baseline = extractBaseline(claimText);
    const measurementConditions = extractMeasurementConditions(claimText);
    return {
      value: `${value}x`,
      unit: "multiplier",
      comparison,
      baseline,
      measurementConditions,
      isBestCaseOnly: isBestCase(claimText),
    };
  }

  // 3. Parameter count: e.g. "500B parameters", "70B model", "1.5T tokens"
  const paramMatch =
    /(\d+(?:\.\d+)?)\s*([BMKTPbmktp])\s*(?:params|parameters|tokens|weights)/i.exec(claimText);
  if (paramMatch && paramMatch[1] && paramMatch[2]) {
    return {
      value: `${paramMatch[1]}${paramMatch[2].toUpperCase()}`,
      unit: "parameters/tokens",
      comparison: "model capacity",
    };
  }

  // 4. Latency / Bandwidth / Hardware metrics: e.g. "20ms latency", "1.8 TB/s memory bandwidth", "200 tok/s"
  const metricMatch =
    /(\d+(?:\.\d+)?)\s*(ms|milliseconds|seconds|s|tokens\/s|tok\/s|TB\/s|GB\/s|GB|TB|PFLOPS|TFLOPS|watts|W)\b/i.exec(
      claimText,
    );
  if (metricMatch && metricMatch[1] && metricMatch[2]) {
    return {
      value: metricMatch[1],
      unit: metricMatch[2],
      baseline: extractBaseline(claimText),
      measurementConditions: extractMeasurementConditions(claimText),
    };
  }

  return undefined;
}

function extractBaseline(text: string): string | undefined {
  // Look for "than X", "compared to X", "over X", "relative to X", "vs X"
  const baselineMatch =
    /(?:than|compared to|relative to|over|versus|vs\.?)\s+([A-Za-z0-9_.\-]+(?:\s+[A-Za-z0-9_.\-]+){0,3})/i.exec(
      text,
    );
  if (baselineMatch && baselineMatch[1]) {
    return baselineMatch[1].trim();
  }
  return undefined;
}

function extractMeasurementConditions(text: string): string | undefined {
  // Look for "on [Benchmark/Hardware]", "under [Workload]", "measured with [Settings]"
  const condMatch =
    /(?:on|under|measured on|evaluated on|using|tested on)\s+((?:MMLU|GSM8K|HumanEval|SWE-bench|MATH|A100|H100|B200|TPU|FP8|INT4|FP16|batch size\s+\d+|temperature\s+\d+(?:\.\d+)?)[A-Za-z0-9_.\s-]*)/i.exec(
      text,
    );
  if (condMatch && condMatch[1]) {
    return condMatch[1].trim();
  }
  return undefined;
}

function isBestCase(text: string): boolean {
  return /up to|best-case|peak|isolated|under optimal conditions/i.test(text);
}

/**
 * Validates causal statements. If the statement uses causal verbs without direct causal proof,
 * generates a weakened, correlational phrasing.
 */
export function validateCausalStatement(
  statement: string,
  hasDirectCausalEvidence: boolean,
): CausalValidation {
  const lower = statement.toLowerCase();
  const foundVerbs: string[] = [];

  for (const verb of CAUSAL_VERBS) {
    if (new RegExp(`\\b${verb}\\b`, "i").test(lower)) {
      foundVerbs.push(verb);
    }
  }

  if (foundVerbs.length === 0) {
    return {
      isCausalClaim: false,
      causalVerbsFound: [],
      supportedByDirectEvidence: true,
    };
  }

  if (hasDirectCausalEvidence) {
    return {
      isCausalClaim: true,
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
    causalVerbsFound: foundVerbs,
    supportedByDirectEvidence: false,
    suggestedWording: weakened,
  };
}

/**
 * Classifies claim type: Fact vs Interpretation vs Forecast
 */
export function classifyClaimType(statement: string): ClaimType {
  const lower = statement.toLowerCase();

  // Forecast indicators
  if (
    /\b(will|projected to|forecast|expected to|anticipated|by 2027|by 2028|by 2030|future|may eventually)\b/i.test(
      lower,
    )
  ) {
    return "forecast";
  }

  // Interpretation / Analysis indicators
  if (
    /\b(suggests|indicates|implies|demonstrates potential|likely reflects|appears to|can be interpreted)\b/i.test(
      lower,
    )
  ) {
    return "interpretation";
  }

  return "fact";
}

/**
 * Splits a compound finding sentence into atomic claims.
 * For example: "Model X was released, is 40% cheaper, and is 2x faster."
 * Becomes 3 atomic claims:
 * 1. Model X was released.
 * 2. Model X is 40% cheaper.
 * 3. Model X is 2x faster.
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
    // Check if sentence contains multiple coordinate clauses with metrics: e.g. "released, and is 40% cheaper and 2x faster"
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
  // If sentence has "released", and also has numerical improvements like "and is 40% cheaper"
  const commaAndRegex = /(.*?(?:released|announced|launched)[^,]*?),\s*(?:and\s+)?(is\s+.*|\d+.*)/i;
  const match = commaAndRegex.exec(sentence);
  if (match && match[1] && match[2]) {
    const part1 = match[1].trim();
    const part2 = match[2].trim();

    // Further check if part2 contains multiple metrics like "40% cheaper and 2x faster"
    const subParts = part2.split(/\s+and\s+(?=\d|is\s+|\w+\s+is)/i);
    return [part1, ...subParts.map((sp) => sp.trim())];
  }

  return [sentence];
}
