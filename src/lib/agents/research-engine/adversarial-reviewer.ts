/**
 * Adversarial Research Reviewer Pass
 * Remispace Deep Research Agent
 */

import { generateText } from "ai";
import { withAiRateLimitRetry, getAiModelName, createAiGatewayProvider } from "@/lib/ai-gateway.server";
import { log } from "@/lib/logger.server";
import type { AdversarialReviewResult, ClaimEvidenceLedgerItem, ResearchSource } from "./types";
import { auditAndCalibrateText } from "./epistemic-calibration";

export async function runAdversarialReview(params: {
  topic: string;
  draftReport: string;
  ledger: ClaimEvidenceLedgerItem[];
  sources: ResearchSource[];
  gateway: ReturnType<typeof createAiGatewayProvider>;
  modelName: string;
}): Promise<AdversarialReviewResult> {
  const { topic, draftReport, ledger, sources, gateway, modelName } = params;

  // Build condensed ledger summary for reviewer
  const ledgerSummary = ledger.map((item, idx) => {
    return `[Claim ${idx + 1}] (${item.claim_type.toUpperCase()} | ${item.verification_status} | Conf: ${item.confidence})
- Claim: "${item.claim}"
- Source: "${item.source_title}" (${item.source_quality})
- Exact Support: ${item.exact_support}
- Experimental Context: Model=${item.model || "N/A"}, Dataset=${item.dataset || "N/A"}, Metric=${item.metric || "N/A"}, Hardware=${item.hardware || "N/A"}
- Shown vs Not Shown: Shown="${item.what_source_showed || "N/A"}" | Not Shown="${item.what_source_did_not_show || "N/A"}"
- Counter Evidence: ${item.counter_evidence || "None found"}`;
  }).join("\n\n");

  const reviewerPrompt = `You are a Hostile, Rigorous Academic Peer Reviewer auditing a research draft for topic: "${topic}".
Your mission is to catch unsubstantiated claims, invalid cross-paper comparisons, missing experimental baselines, overgeneralized conclusions, and unhedged absolute assertions.

Claim-Evidence Ledger (Ground Truth from Primary Literature):
${ledgerSummary}

Draft Report to Audit:
${draftReport}

Audit Checklist (Examine all 14 dimensions):
1. Unsupported claims: Any claim in draft not backed by the ledger?
2. Citation mismatches: Citations disconnected from actual paper findings?
3. Numerical numbers: Missing baselines, hardware, or datasets?
4. Overgeneralization: Results on small models/synthetic datasets claimed as universal for frontier LLMs?
5. Cross-paper comparisons: Results from disparate setups compared directly without noting "indirect comparison"?
6. Absolute language: Unverified "no method exists", "universally proves", "solves"?
7. Paper characterization: Misrepresenting what the paper actually proved vs what it did NOT show?
8. Weak research gaps: Asserting "no benchmark exists" without verifying benchmark repos?
9. Correlation vs Causation confusion?
10. Unclear experimental boundaries?
11. Contradictions ignored?

Instructions:
1. Provide a revised, publication-grade version of the report that:
   - Fixes all identified inaccuracies and attaches missing experimental contexts (model, dataset, hardware, baseline).
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
            "You are a rigorous, hostile academic reviewer and revision editor who enforces strict evidence grounding and epistemic modesty.",
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

  // Run final deterministic epistemic calibration on the revised report
  const calibration = auditAndCalibrateText(revisedReport, ledger);
  revisedReport = calibration.calibratedText;

  return {
    overallAssessment: "REVISE",
    identifiedWeaknesses: calibration.flaggedTerms.map((t) => ({
      dimension: "Epistemic Calibration",
      issue: t,
      recommendedCorrection: "Calibrated to evidence-bounded formulation",
      severity: "MINOR",
    })),
    unsupportedClaimsToPrune: ledger.filter((l) => l.verification_status === "UNSUPPORTED").map((l) => l.claim),
    absoluteClaimsToCalibrate: calibration.flaggedTerms.map((t) => ({ original: t, calibrated: "Calibrated" })),
    uncalibratedComparisons: [],
    revisedReport,
  };
}
