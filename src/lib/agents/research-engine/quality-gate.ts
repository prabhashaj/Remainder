/**
 * Research Quality Gate & Weighted Scoring
 * Remispace Deep Research Agent
 */

import type {
  CanonicalSource,
  CitationAuditResult,
  ClaimEvidenceLedgerItem,
  ResearchQualityMetrics,
} from "./types";
import { log } from "@/lib/logger.server";

export function evaluateResearchQualityGate(params: {
  ledger: ClaimEvidenceLedgerItem[];
  sources: CanonicalSource[];
  citationAudit: CitationAuditResult;
  contradictionsCount: number;
  uncalibratedTermsCount: number;
  inventedContextsCount: number;
}): ResearchQualityMetrics {
  const { ledger, sources, citationAudit, contradictionsCount, uncalibratedTermsCount, inventedContextsCount } = params;

  const totalClaims = ledger.length;
  const verifiedClaims = ledger.filter(
    (l) => l.verification_status === "VERIFIED" || l.support_level === "DIRECTLY_SUPPORTED" || l.support_level === "PARTIALLY_SUPPORTED",
  );
  const verifiedClaimsRatio = totalClaims > 0 ? verifiedClaims.length / totalClaims : 1.0;

  const tier1And2Sources = sources.filter((s) => s.tierRank === 1 || s.tierRank === 2);
  const tier1And2SourcesRatio = sources.length > 0 ? tier1And2Sources.length / sources.length : 1.0;

  // 1. Citation Correctness Score (20%)
  const citationCorrectnessScore = Math.max(
    0,
    citationAudit.citationEntailmentRatio - citationAudit.wrongPaperAttributionCount * 0.15,
  );

  // 2. Claim-Evidence Support Score (20%)
  const directlySupportedClaims = ledger.filter((l) => l.support_level === "DIRECTLY_SUPPORTED");
  const claimEvidenceSupportScore = totalClaims > 0 ? directlySupportedClaims.length / totalClaims : 1.0;

  // 3. Source Identity & Metadata Accuracy (15%)
  const uncertainSources = sources.filter((s) => s.verification_status === "SOURCE_IDENTITY_UNCERTAIN");
  const sourceIdentityMetadataScore = sources.length > 0 ? Math.max(0, 1.0 - (uncertainSources.length / sources.length)) : 1.0;

  // 4. Numerical & Metric Accuracy (10%)
  const numericalClaims = ledger.filter((l) => l.claim_type === "numerical" || /\d+/.test(l.claim));
  const groundedNumerical = numericalClaims.filter(
    (l) => l.verification_status === "VERIFIED" && l.model && l.dataset && !l.original_metric_wording?.includes("drift"),
  );
  const numericalMetricAccuracyScore = numericalClaims.length > 0 ? groundedNumerical.length / numericalClaims.length : 1.0;

  // 5. Research-Gap Validity (10%)
  const gapClaims = ledger.filter((l) => l.claim_type === "research_gap");
  const validGaps = gapClaims.filter((g) => g.verification_status !== "CONTRADICTED");
  const researchGapValidityScore = gapClaims.length > 0 ? validGaps.length / gapClaims.length : 1.0;

  // 6. Comparative Validity (10%)
  const comparativeClaims = ledger.filter((l) => l.claim_type === "comparative");
  const validComparisons = comparativeClaims.filter((c) => c.is_direct_comparison !== undefined);
  const comparativeValidityScore = comparativeClaims.length > 0 ? validComparisons.length / comparativeClaims.length : 1.0;

  // 7. Source Quality (5%)
  const sourceQualityScore = tier1And2SourcesRatio;

  // 8. Contradiction Coverage (5%)
  const contradictionCoverageScore = contradictionsCount > 0 ? 1.0 : 0.8;

  // 9. Uncertainty Calibration & Anti-Invented Details (5%)
  const calibrationPenalty = (uncalibratedTermsCount * 0.05) + (inventedContextsCount * 0.1);
  const uncertaintyCalibrationScore = Math.max(0, 1.0 - calibrationPenalty);

  // Calculate Weighted Overall Quality Score (0 to 100)
  const overallScore = Math.round(
    citationCorrectnessScore * 20 +
    claimEvidenceSupportScore * 20 +
    sourceIdentityMetadataScore * 15 +
    numericalMetricAccuracyScore * 10 +
    researchGapValidityScore * 10 +
    comparativeValidityScore * 10 +
    sourceQualityScore * 5 +
    contradictionCoverageScore * 5 +
    uncertaintyCalibrationScore * 5,
  );

  const gateFailures: string[] = [];
  if (citationCorrectnessScore < 0.7) gateFailures.push("Citation correctness below threshold (<70%)");
  if (claimEvidenceSupportScore < 0.7) gateFailures.push("Direct claim-evidence support below threshold (<70%)");
  if (sourceIdentityMetadataScore < 0.7) gateFailures.push("Source identity/metadata resolution uncertain (<70%)");
  if (citationAudit.wrongPaperAttributionCount > 0) gateFailures.push("Wrong paper attribution detected");
  if (inventedContextsCount > 0) gateFailures.push("Invented hardware/experimental context detected");

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
    citationCorrectnessScore: Number(citationCorrectnessScore.toFixed(2)),
    claimEvidenceSupportScore: Number(claimEvidenceSupportScore.toFixed(2)),
    sourceIdentityMetadataScore: Number(sourceIdentityMetadataScore.toFixed(2)),
    numericalMetricAccuracyScore: Number(numericalMetricAccuracyScore.toFixed(2)),
    researchGapValidityScore: Number(researchGapValidityScore.toFixed(2)),
    comparativeValidityScore: Number(comparativeValidityScore.toFixed(2)),
    sourceQualityScore: Number(sourceQualityScore.toFixed(2)),
    contradictionCoverageScore: Number(contradictionCoverageScore.toFixed(2)),
    uncertaintyCalibrationScore: Number(uncertaintyCalibrationScore.toFixed(2)),
    overallScore,
    passedQualityGate,
    gateFailures,
    confidenceSummary,
  };

  log("info", "deep_research_quality_gate_evaluated", {
    overallScore,
    passedQualityGate,
    citationCorrectnessScore: metrics.citationCorrectnessScore,
    claimEvidenceSupportScore: metrics.claimEvidenceSupportScore,
    sourceIdentityMetadataScore: metrics.sourceIdentityMetadataScore,
    gateFailures,
  });

  return metrics;
}
