/**
 * Research Quality Gate & Observability Scoring
 * Remispace Deep Research Agent
 */

import type {
  CitationAuditResult,
  ClaimEvidenceLedgerItem,
  ResearchQualityMetrics,
  ResearchSource,
} from "./types";
import { log } from "@/lib/logger.server";

export function evaluateResearchQualityGate(params: {
  ledger: ClaimEvidenceLedgerItem[];
  sources: ResearchSource[];
  citationAudit: CitationAuditResult;
  contradictionsCount: number;
  uncalibratedTermsCount: number;
}): ResearchQualityMetrics {
  const { ledger, sources, citationAudit, contradictionsCount, uncalibratedTermsCount } = params;

  const totalClaims = ledger.length;
  const verifiedClaims = ledger.filter((l) => l.verification_status === "VERIFIED" || l.verification_status === "PARTIALLY_SUPPORTED");
  const verifiedClaimsRatio = totalClaims > 0 ? verifiedClaims.length / totalClaims : 1.0;

  const tier1And2Sources = sources.filter((s) => s.tierRank === 1 || s.tierRank === 2);
  const tier1And2SourcesRatio = sources.length > 0 ? tier1And2Sources.length / sources.length : 1.0;

  // Numerical claims grounding score
  const numericalClaims = ledger.filter((l) => l.claim_type === "numerical");
  const groundedNumericalClaims = numericalClaims.filter((l) => l.verification_status === "VERIFIED" && l.model && l.dataset);
  const numericalGroundingScore = numericalClaims.length > 0 ? groundedNumericalClaims.length / numericalClaims.length : 1.0;

  // Contradiction and counter-evidence coverage score
  const contradictionCoverageScore = contradictionsCount > 0 ? 1.0 : 0.75;

  // Calibration score (penalizes uncalibrated absolute terms)
  const calibrationScore = Math.max(0, 1.0 - uncalibratedTermsCount * 0.1);

  // Citation entailment score
  const citationEntailmentScore = citationAudit.citationEntailmentRatio;

  // Calculate Weighted Overall Quality Score (0 to 100)
  // Evidence Coverage: 25%, Source Quality: 20%, Numerical Grounding: 15%, Citation Entailment: 15%, Contradiction Coverage: 10%, Calibration: 15%
  const overallScore = Math.round(
    verifiedClaimsRatio * 25 +
    tier1And2SourcesRatio * 20 +
    numericalGroundingScore * 15 +
    citationEntailmentScore * 15 +
    contradictionCoverageScore * 10 +
    calibrationScore * 15
  );

  const gateFailures: string[] = [];
  if (verifiedClaimsRatio < 0.7) gateFailures.push("Low verified claims ratio (<70%)");
  if (tier1And2SourcesRatio < 0.3) gateFailures.push("Insufficient Tier 1/2 primary literature (<30%)");
  if (citationEntailmentScore < 0.7) gateFailures.push("Citation-to-claim entailment mismatch (<70%)");
  if (calibrationScore < 0.7) gateFailures.push("Uncalibrated absolute claims present");

  const passedQualityGate = overallScore >= 75 && gateFailures.length === 0;

  const confidenceSummary = {
    high: ledger.filter((l) => l.confidence === "HIGH").length,
    medium: ledger.filter((l) => l.confidence === "MEDIUM").length,
    low: ledger.filter((l) => l.confidence === "LOW").length,
    unverified: ledger.filter((l) => l.confidence === "UNVERIFIED").length,
  };

  const metrics: ResearchQualityMetrics = {
    totalClaims,
    verifiedClaimsCount: verifiedClaims.length,
    verifiedClaimsRatio,
    tier1And2SourcesRatio,
    numericalGroundingScore,
    contradictionCoverageScore,
    calibrationScore,
    citationEntailmentScore,
    overallScore,
    passedQualityGate,
    gateFailures,
    confidenceSummary,
  };

  log("info", "deep_research_quality_gate_evaluated", {
    overallScore,
    passedQualityGate,
    totalClaims,
    verifiedClaimsCount: verifiedClaims.length,
    tier1And2SourcesRatio: Number(tier1And2SourcesRatio.toFixed(2)),
    citationEntailmentScore: Number(citationEntailmentScore.toFixed(2)),
    gateFailures,
  });

  return metrics;
}
