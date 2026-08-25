/**
 * Adversarial Research Reviewer Pass
 * Remispace Deep Research Agent
 */

import { generateText } from "ai";
import { withAiRateLimitRetry, createAiGatewayProvider } from "@/lib/ai-gateway.server";
import { log } from "@/lib/logger.server";
import type { AdversarialReviewResult, CanonicalSource, ClaimEvidenceLedgerItem } from "./types";
import { auditAndCalibrateText } from "./epistemic-calibration";

export async function runAdversarialReview(params: {
  topic: string;
  draftReport: string;
  ledger: ClaimEvidenceLedgerItem[];
  sources: CanonicalSource[];
  gateway: ReturnType<typeof createAiGatewayProvider>;
  modelName: string;
}): Promise<AdversarialReviewResult> {
  const { topic, draftReport, ledger, sources, gateway, modelName } = params;

  // Build condensed ledger summary for reviewer
  const ledgerSummary = ledger.map((item, idx) => {
    return `[Claim ${idx + 1}] (${item.claim_type.toUpperCase()} | ${item.verification_status} | Support: ${item.support_level} | Conf: ${item.confidence})
- Claim: "${item.claim}"
- Canonical Source: "${item.source_title}" [ID: ${item.source_ids.join(", ")}] (${item.source_quality})
- Exact Verbatim Support: "${item.exact_support}"
- Contribution vs Related: ${item.paper_contribution_vs_related || "paper_contribution"}
- Experimental Context: Model=${item.model || "Not reported"}, Dataset=${item.dataset || "Not reported"}, Metric=${item.metric || "Not reported"}, Hardware=${item.hardware || "Not reported in the source"}
- Evaluated Scope: Shown="${item.what_source_showed || "N/A"}" | Not Shown="${item.what_source_did_not_show || "N/A"}"
- Counter Evidence: ${item.counter_evidence || "None found"}`;
  }).join("\n\n");

  const sourcesList = sources.slice(0, 15).map((s) => `[${s.source_id}] "${s.canonical_title}" (${s.yearOrId}) - ${s.source_tier}`).join("\n");

  const reviewerPrompt = `You are a Hostile, Rigorous Academic Peer Reviewer auditing a research draft for topic: "${topic}".
Your mission is to catch:
1. Source-Entity Resolution Errors & Wrong Paper Attributions (e.g., citing a 2024 related paper for an algorithm introduced in 2019/2020).
2. Publication Year Inaccuracies (e.g., representing a 2022 paper as 2026).
3. Metric Drift (e.g., rewriting "best scores" into "final reward").
4. Invented Experimental Contexts (e.g., "assumed standard GPU clusters" -> MUST be "Hardware: Not reported in the source").
5. Mathematical Formulation Drift (e.g., generic background equations attributed as a specific algorithm's formulation).
6. Incorrect "No Empirical Validation" claims for papers that have experiments.
7. Subjective comparison tables (High/Medium/Low) without defined methodology.
8. Uncalibrated absolute assertions ("no method exists", "universally proves", "solves").

Canonical Source Registry (Ground Truth Sources):
${sourcesList}

Claim-Evidence Ledger (Ground Truth Primary Evidence):
${ledgerSummary}

Draft Report to Audit:
${draftReport}

Audit & Repair Instructions:
1. Provide a revised, publication-grade version of the report that:
   - Fixes all identified inaccuracies, wrong paper attributions, and metric drifts.
   - Cleanses any invented hardware/experimental context to explicit "Not reported in the source".
   - Weakens or calibrates any overconfident or absolute claims.
   - Clarifies indirect cross-paper comparisons with explicit notes.
   - Preserves all valid technical depth, mathematical LaTeX expressions, and core verified findings.
2. Return ONLY the complete, revised research report in clean Markdown format without conversational meta-commentary.`;

  let revisedReport = draftReport;
  try {
    const { text } = await withAiRateLimitRetry(
      () =>
        generateText({
          model: gateway(modelName),
          system:
            "You are a rigorous, hostile academic reviewer and revision editor who enforces strict evidence grounding, canonical citation identity, and epistemic modesty.",
          prompt: reviewerPrompt,
        }),
      { label: "Adversarial Reviewer", maxRetries: 2 },
    );

    if (text && text.trim().length > 500) {
      revisedReport = text;
    }
  } catch (err) {
    log("warn", "adversarial_review_fallback", { error: String(err) });
  }

  // Run deterministic epistemic calibration on the revised report
  const calibration = auditAndCalibrateText(revisedReport, ledger);
  revisedReport = calibration.calibratedText;

  return {
    overallAssessment: "REVISE",
    identifiedWeaknesses: calibration.flaggedTerms.map((t) => ({
      dimension: "Epistemic Calibration & Rigor",
      issue: t,
      recommendedCorrection: "Calibrated to evidence-bounded formulation",
      severity: "MINOR",
    })),
    unsupportedClaimsToPrune: ledger.filter((l) => l.verification_status === "UNSUPPORTED").map((l) => l.claim),
    absoluteClaimsToCalibrate: calibration.flaggedTerms.map((t) => ({ original: t, calibrated: "Calibrated" })),
    uncalibratedComparisons: [],
    inventedContextsToCleanse: calibration.flaggedTerms.filter((t) => t.includes("hardware") || t.includes("assumed")),
    wrongPaperAttributions: [],
    revisedReport,
  };
}
