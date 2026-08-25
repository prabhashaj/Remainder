/**
 * Claim-Evidence Ledger & Verification Engine
 * Remispace Deep Research Agent
 */

import { z } from "zod";
import type {
  CanonicalSource,
  ClaimEvidenceLedgerItem,
  ClaimType,
  ConfidenceLevel,
  EvidenceLevel,
  MathematicalFormulationType,
  NumericalVerificationResult,
  SupportLevel,
  VerificationStatus,
} from "./types";

export const ClaimItemSchema = z.object({
  claim: z.string().describe("The exact declarative research claim"),
  claim_type: z.enum([
    "factual",
    "theoretical",
    "empirical",
    "numerical",
    "comparative",
    "causal",
    "interpretive",
    "recommendation",
    "research_gap",
  ]),
  importance: z.enum(["core", "supporting", "background"]),
  source_id: z.string().optional().describe("Canonical source ID like SOURCE_001"),
  source_title: z.string().describe("Canonical title of primary supporting source"),
  source_url: z.string().describe("URL or identifier of the source"),
  exact_support: z.string().describe("Exact quote or verbatim snippet from the source supporting this claim"),
  support_level: z
    .enum(["DIRECTLY_SUPPORTED", "PARTIALLY_SUPPORTED", "INDIRECTLY_SUPPORTED", "UNSUPPORTED", "CONTRADICTED"])
    .default("DIRECTLY_SUPPORTED"),

  // Paper Contribution vs Related Concept
  paper_contribution_vs_related: z
    .enum(["paper_contribution", "related_concept", "background"])
    .default("paper_contribution")
    .describe("Whether this claim reflects the paper's original contribution, or a related concept it merely cited/evaluated"),

  // Metric Semantics
  original_metric_wording: z.string().optional().describe("Exact verbatim metric wording used in the paper"),
  metric_name: z.string().optional().describe("Standardized metric name (e.g., Best-Score Attainment, MMLU 5-shot Accuracy)"),

  // Experimental & System Context (Hard Rule: Never infer missing hardware/parameters)
  model: z.string().optional().describe("Specific model/architecture evaluated (e.g. LLaMA-3-8B, GPT-4). Do NOT guess."),
  dataset: z.string().optional().describe("Specific benchmark or environment evaluated (e.g. MMLU, MuJoCo HalfCheetah-v2). Do NOT guess."),
  task: z.string().optional().describe("Task or domain of evaluation"),
  metric: z.string().optional().describe("Metric evaluated"),
  reported_result: z.string().optional().describe("Exact numerical or empirical result reported"),
  baseline: z.string().optional().describe("Baseline or control compared against"),
  hardware: z.string().optional().describe("Hardware setup. Write 'Not reported in the source' if absent. NEVER assume or infer."),
  experimental_context: z.string().optional().describe("Full experimental context (batch size, precision, seeds)"),
  evidence_level: z
    .enum([
      "theoretical",
      "simulation",
      "laboratory_experiment",
      "benchmark_evaluation",
      "large_scale_evaluation",
      "production_deployment",
    ])
    .optional(),

  // Mathematical Fidelity
  math_formulation_type: z
    .enum([
      "direct_paper_formulation",
      "mathematically_equivalent",
      "background_formulation",
      "explanatory_simplification",
      "author_synthesis",
    ])
    .optional(),
  math_equation: z.string().optional().describe("LaTeX formula if claim concerns a mathematical equation"),

  // Rigor
  what_source_showed: z.string().optional().describe("What the paper actually demonstrated"),
  what_source_did_not_show: z.string().optional().describe("What the paper did NOT demonstrate or test"),
  limitations: z.string().optional().describe("Reported limitations or scope boundaries"),
  is_direct_comparison: z.boolean().optional().describe("True if compared under identical conditions, false if cross-study"),
  comparison_notes: z.string().optional(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW", "UNVERIFIED"]),
  verification_status: z.enum([
    "VERIFIED",
    "PARTIALLY_SUPPORTED",
    "UNSUPPORTED",
    "CONTRADICTED",
    "SOURCE_IDENTITY_UNCERTAIN",
    "UNVERIFIED",
  ]),
});

export const LedgerExtractionSchema = z.object({
  claims: z.array(ClaimItemSchema),
});

/**
 * Extracts numbers, percentages, speedups, and metrics from text for deterministic matching.
 */
export function extractNumericTokens(text: string): string[] {
  if (!text) return [];
  const regex = /\b\d+(?:\.\d+)?\s*(?:%|x|×|times|tokens\/s|tflops|flops|gflops|ms|gb|mb|tb|b|m|k)?/gi;
  const matches = text.match(regex) || [];
  return matches.map((m) => m.toLowerCase().replace(/\s+/g, "").trim()).filter(Boolean);
}

/**
 * Detects and cleanses invented experimental context phrases.
 */
export function sanitizeExperimentalContext(input?: string): { value: string; wasInvented: boolean } {
  if (!input) return { value: "Not reported in the source", wasInvented: false };
  const lower = input.toLowerCase();

  const inventedPatterns = [
    /assumed\s+/i,
    /likely\s+(?:h100|a100|gpu|v100|cluster|3 seeds)/i,
    /probably\s+/i,
    /typical\s+configuration/i,
    /standard\s+gpu\s+clusters/i,
    /inferred\s+/i,
    /unspecified\s*\(assumed/i,
  ];

  for (const pattern of inventedPatterns) {
    if (pattern.test(lower)) {
      return { value: "Not reported in the source", wasInvented: true };
    }
  }

  return { value: input, wasInvented: false };
}

/**
 * Checks whether metric semantics have drifted between raw evidence and the stated claim.
 */
export function auditMetricDrift(
  claim: string,
  exactSupport: string,
): { hasDrift: boolean; warning?: string; calibratedClaim?: string } {
  const claimLower = claim.toLowerCase();
  const supportLower = exactSupport.toLowerCase();

  // Pattern 1: "best score / peak score" transformed into "final reward"
  if (
    (supportLower.includes("best score") || supportLower.includes("peak score") || supportLower.includes("highest score")) &&
    (claimLower.includes("final reward") || claimLower.includes("cumulative return") || claimLower.includes("average reward"))
  ) {
    return {
      hasDrift: true,
      warning: "Metric drift: Paper reported peak/best-score attainment, but claim rewrote as final/cumulative reward.",
      calibratedClaim: claim.replace(/final reward|cumulative return|average reward/gi, "peak best-score attainment"),
    };
  }

  // Pattern 2: Component-level latency transformed into end-to-end latency
  if (
    (supportLower.includes("kernel execution") || supportLower.includes("attention computation") || supportLower.includes("layer latency")) &&
    (claimLower.includes("end-to-end inference") || claimLower.includes("total system speedup") || claimLower.includes("overall latency"))
  ) {
    return {
      hasDrift: true,
      warning: "Metric drift: Paper evaluated component-level kernel speedup, but claim asserted end-to-end system speedup.",
      calibratedClaim: claim.replace(/end-to-end inference|total system speedup|overall latency/gi, "isolated attention computation latency"),
    };
  }

  return { hasDrift: false };
}

/**
 * Deterministically verifies whether a numerical claim is substantiated by its supporting source text.
 */
export function verifyNumericalClaim(
  claim: string,
  exactSupport: string,
  sourceText: string,
): NumericalVerificationResult {
  const claimFigures = extractNumericTokens(claim);
  const combinedSourceText = `${exactSupport} ${sourceText}`.toLowerCase();
  const sourceFigures = extractNumericTokens(combinedSourceText);

  const sanitizedHardware = sanitizeExperimentalContext(exactSupport);

  if (claimFigures.length === 0) {
    return {
      hasNumericalClaim: false,
      numberFoundInSource: true,
      extractedFigures: [],
      sourceFigures,
      metricMatched: true,
      metricDriftDetected: false,
      baselineSpecified: true,
      modelSpecified: true,
      datasetSpecified: true,
      hardwareReported: !sanitizedHardware.wasInvented,
      inventedHardwareDetected: sanitizedHardware.wasInvented,
      isTheoreticalOrMeasured: "unspecified",
      isEndToEndOrComponent: "unspecified",
      verificationStatus: "VERIFIED",
      notes: "No quantitative figures in claim.",
    };
  }

  // Check if each numeric figure in the claim exists in source text
  const missingFigures: string[] = [];
  for (const figure of claimFigures) {
    const rawNumber = figure.replace(/[^0-9.]/g, "");
    if (!rawNumber) continue;

    const existsExact = combinedSourceText.includes(figure);
    const existsRaw = combinedSourceText.includes(rawNumber);

    if (!existsExact && !existsRaw) {
      missingFigures.push(figure);
    }
  }

  const numberFoundInSource = missingFigures.length === 0;

  // Check metric drift
  const metricDrift = auditMetricDrift(claim, exactSupport);

  // Check baseline indicators
  const baselineKeywords = ["baseline", "compared to", "versus", "vs", "over", "relative to", "standard"];
  const baselineSpecified = baselineKeywords.some((k) => claim.toLowerCase().includes(k) || exactSupport.toLowerCase().includes(k));

  const modelSpecified = /\b(model|llama|gpt|bert|transformer|resnet|diffusion|architecture|agent|parameters|7b|70b)\b/i.test(
    `${claim} ${exactSupport}`,
  );
  const datasetSpecified = /\b(dataset|benchmark|mmlu|gsm8k|humaneval|imagenet|glue|squad|mujoco|atari|test set|evaluation)\b/i.test(
    `${claim} ${exactSupport}`,
  );

  let verificationStatus: VerificationStatus = "VERIFIED";
  let notes = "Numerical claim verified in source context.";

  if (!numberFoundInSource) {
    verificationStatus = "UNSUPPORTED";
    notes = `Numerical discrepancy: Figures [${missingFigures.join(", ")}] not found in cited source text.`;
  } else if (metricDrift.hasDrift) {
    verificationStatus = "PARTIALLY_SUPPORTED";
    notes = metricDrift.warning || "Metric semantics altered from original paper.";
  } else if (!baselineSpecified && (claim.includes("speedup") || claim.includes("improvement") || claim.includes("reduction") || claim.includes("faster"))) {
    verificationStatus = "PARTIALLY_SUPPORTED";
    notes = "Relative numerical gain cited without specifying the baseline or control setup.";
  }

  return {
    hasNumericalClaim: true,
    numberFoundInSource,
    extractedFigures: claimFigures,
    sourceFigures,
    metricMatched: !metricDrift.hasDrift,
    metricDriftDetected: metricDrift.hasDrift,
    baselineSpecified,
    modelSpecified,
    datasetSpecified,
    hardwareReported: !sanitizedHardware.wasInvented,
    inventedHardwareDetected: sanitizedHardware.wasInvented,
    isTheoreticalOrMeasured: combinedSourceText.includes("measured") || combinedSourceText.includes("empirical") ? "measured" : "unspecified",
    isEndToEndOrComponent: combinedSourceText.includes("end-to-end") ? "end_to_end" : "unspecified",
    verificationStatus,
    notes,
  };
}

/**
 * Checks for context mismatch between claim generalization and source evaluation boundaries.
 */
export function auditContextMismatch(claim: string, item: Partial<ClaimEvidenceLedgerItem>): {
  hasMismatch: boolean;
  mismatchReason?: string;
  calibratedClaim?: string;
} {
  const claimLower = claim.toLowerCase();
  const sourceWhatShowed = (item.what_source_showed || "").toLowerCase();
  const sourceWhatNotShowed = (item.what_source_did_not_show || "").toLowerCase();
  const modelContext = (item.model || "").toLowerCase();

  // Pattern 1: Claim generalizes to all LLMs / frontier models, but source only evaluated on small/older models
  const claimsUniversalLLMs = claimLower.includes("large language models") || claimLower.includes("frontier models") || claimLower.includes("modern llms") || claimLower.includes("all transformer models");
  const isSmallModelOnly = modelContext.includes("gpt-2") || modelContext.includes("bert") || modelContext.includes("roberta") || modelContext.includes("toy") || sourceWhatShowed.includes("gpt-2") || sourceWhatShowed.includes("small research model");

  if (claimsUniversalLLMs && isSmallModelOnly) {
    return {
      hasMismatch: true,
      mismatchReason: `Context mismatch: Claim states broad LLM generalization, but study evaluated only on ${item.model || "small research models"}.`,
      calibratedClaim: claim.replace(/large language models|frontier models|modern llms|all transformer models/gi, `${item.model || "smaller models (e.g. GPT-2)"}`),
    };
  }

  // Pattern 2: Claim asserts production readiness, but source only conducted synthetic/lab experiments
  const claimsProduction = claimLower.includes("production ready") || claimLower.includes("ready for deployment") || claimLower.includes("production systems");
  const isLabOnly = item.evidence_level === "simulation" || item.evidence_level === "laboratory_experiment" || sourceWhatNotShowed.includes("production") || sourceWhatNotShowed.includes("real-world");

  if (claimsProduction && isLabOnly) {
    return {
      hasMismatch: true,
      mismatchReason: "Context mismatch: Laboratory / simulation evaluation cited as production-ready.",
      calibratedClaim: claim.replace(/production ready|ready for deployment|production systems/gi, "validated under controlled experimental conditions"),
    };
  }

  return { hasMismatch: false };
}

/**
 * Audits cross-paper comparison between two items to ensure experimental conditions match.
 */
export function auditCrossPaperComparison(
  itemA: ClaimEvidenceLedgerItem,
  itemB: ClaimEvidenceLedgerItem,
): { isDirect: boolean; note: string } {
  const modelMatch = Boolean(itemA.model && itemB.model && itemA.model.toLowerCase() === itemB.model.toLowerCase());
  const datasetMatch = Boolean(itemA.dataset && itemB.dataset && itemA.dataset.toLowerCase() === itemB.dataset.toLowerCase());
  const hardwareMatch = Boolean(itemA.hardware && itemB.hardware && itemA.hardware.toLowerCase() === itemB.hardware.toLowerCase());

  if (modelMatch && datasetMatch && (hardwareMatch || (!itemA.hardware && !itemB.hardware))) {
    return {
      isDirect: true,
      note: "Direct comparison: Evaluated on identical model architecture and benchmark dataset.",
    };
  }

  return {
    isDirect: false,
    note: `Indirect comparison: Studies utilized different evaluation conditions (Method A: ${itemA.model || "unspecified model"} on ${itemA.dataset || "unspecified dataset"}; Method B: ${itemB.model || "unspecified model"} on ${itemB.dataset || "unspecified dataset"}). Direct numerical comparison is not valid without unified benchmarking.`,
  };
}
