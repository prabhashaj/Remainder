/**
 * Research Engine Core Types & Data Structures
 * Remispace Deep Research Agent — Research Quality & Epistemic Verification
 */

export type SourceTier =
  | "Tier 1: Peer-Reviewed Journal / Top Conference"
  | "Tier 2: arXiv Preprint / Official Lab Publication"
  | "Tier 3: Technical Report / Official Documentation"
  | "Tier 4: Academic Survey / Systematic Review"
  | "Tier 5: Industry / Engineering Blog"
  | "Tier 6: General Web / Community Forum";

export type ClaimType =
  | "factual"
  | "theoretical"
  | "empirical"
  | "numerical"
  | "comparative"
  | "causal"
  | "interpretive"
  | "recommendation"
  | "research_gap";

export type VerificationStatus =
  | "VERIFIED"
  | "PARTIALLY_SUPPORTED"
  | "UNSUPPORTED"
  | "CONTRADICTED"
  | "UNVERIFIED";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";

export type EvidenceLevel =
  | "theoretical"
  | "simulation"
  | "laboratory_experiment"
  | "benchmark_evaluation"
  | "large_scale_evaluation"
  | "production_deployment";

export interface ResearchSource {
  id: string;
  title: string;
  url: string;
  authors: string[];
  year?: number | undefined;
  yearOrId: string;
  venue?: string | undefined;
  type: string;
  tier: SourceTier;
  tierRank: number; // 1 to 6 (1 = highest)
  abstractOrSnippet: string;
  citationCount?: number | undefined;
  isPrimarySource: boolean;
}

export interface ClaimEvidenceLedgerItem {
  claim_id: string;
  claim: string;
  claim_type: ClaimType;
  importance: "core" | "supporting" | "background";
  source_ids: string[];
  source_quality: SourceTier;
  source_title: string;
  source_url: string;
  source_type: string;
  publication_year: number | string;
  exact_support: string;

  // Experimental & System Context
  model?: string | undefined;
  dataset?: string | undefined;
  task?: string | undefined;
  metric?: string | undefined;
  reported_result?: string | undefined;
  baseline?: string | undefined;
  hardware?: string | undefined;
  experimental_context?: string | undefined;
  evidence_level?: EvidenceLevel | undefined;

  // Deep Verification
  what_source_showed?: string | undefined;
  what_source_did_not_show?: string | undefined;
  limitations?: string | undefined;
  is_direct_comparison?: boolean | undefined;
  comparison_notes?: string | undefined;
  counter_evidence?: string | undefined;
  confidence: ConfidenceLevel;
  verification_status: VerificationStatus;
}

export interface NumericalVerificationResult {
  hasNumericalClaim: boolean;
  numberFoundInSource: boolean;
  extractedFigures: string[];
  sourceFigures: string[];
  metricMatched: boolean;
  baselineSpecified: boolean;
  modelSpecified: boolean;
  datasetSpecified: boolean;
  isTheoreticalOrMeasured: "theoretical" | "measured" | "unspecified";
  isEndToEndOrComponent: "end_to_end" | "component_level" | "unspecified";
  verificationStatus: VerificationStatus;
  notes: string;
}

export interface CitationAuditResult {
  totalCitationsAudited: number;
  verifiedCount: number;
  partiallySupportedCount: number;
  unsupportedCount: number;
  citationEntailmentRatio: number;
  auditItems: Array<{
    claimSnippet: string;
    sourceTitle: string;
    sourceUrl: string;
    status: VerificationStatus;
    reason: string;
  }>;
}

export interface AdversarialReviewResult {
  overallAssessment: "ACCEPT" | "REVISE" | "REJECT_UNSUPPORTED";
  identifiedWeaknesses: Array<{
    dimension: string;
    issue: string;
    recommendedCorrection: string;
    severity: "CRITICAL" | "MAJOR" | "MINOR";
  }>;
  unsupportedClaimsToPrune: string[];
  absoluteClaimsToCalibrate: Array<{ original: string; calibrated: string }>;
  uncalibratedComparisons: string[];
  revisedReport?: string | undefined;
}

export interface ResearchQualityMetrics {
  totalClaims: number;
  verifiedClaimsCount: number;
  verifiedClaimsRatio: number;
  tier1And2SourcesRatio: number;
  numericalGroundingScore: number;
  contradictionCoverageScore: number;
  calibrationScore: number;
  citationEntailmentScore: number;
  overallScore: number; // 0 to 100
  passedQualityGate: boolean;
  gateFailures: string[];
  confidenceSummary: {
    high: number;
    medium: number;
    low: number;
    unverified: number;
  };
}
