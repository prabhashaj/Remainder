/**
 * Research Engine Core Types & Data Structures
 * Remispace Deep Research Agent — Research Quality, Canonical Source Registry & Epistemic Verification
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
  | "SOURCE_IDENTITY_UNCERTAIN"
  | "UNVERIFIED";

export type SupportLevel =
  | "DIRECTLY_SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "INDIRECTLY_SUPPORTED"
  | "UNSUPPORTED"
  | "CONTRADICTED";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";

export type EvidenceLevel =
  | "theoretical"
  | "simulation"
  | "laboratory_experiment"
  | "benchmark_evaluation"
  | "large_scale_evaluation"
  | "production_deployment";

export type MathematicalFormulationType =
  | "direct_paper_formulation"
  | "mathematically_equivalent"
  | "background_formulation"
  | "explanatory_simplification"
  | "author_synthesis";

export interface CanonicalSource {
  source_id: string; // e.g. "SOURCE_001"
  canonical_title: string;
  normalized_title: string;
  authors: string[];
  publication_year?: number | undefined;
  preprint_year?: number | undefined;
  yearOrId: string;
  venue?: string | undefined;
  doi?: string | undefined;
  arxiv_id?: string | undefined;
  canonical_url: string;
  source_type: string;
  source_tier: SourceTier;
  tierRank: number; // 1 to 6 (1 = highest)
  publisher?: string | undefined;
  retrieved_urls: string[];
  aliases: string[];
  abstractOrSnippet: string;
  citationCount?: number | undefined;
  verification_status: "VERIFIED" | "SOURCE_IDENTITY_UNCERTAIN" | "UNVERIFIED";
  isPrimarySource: boolean;
  paper_contribution?: string | undefined;
  has_experiments?: boolean | undefined;
}

// Backward-compatible alias for existing code
export type ResearchSource = CanonicalSource;

export interface ClaimEvidenceLedgerItem {
  claim_id: string;
  claim: string;
  claim_type: ClaimType;
  importance: "core" | "supporting" | "background";
  source_ids: string[];
  evidence_ids?: string[] | undefined;
  source_quality: SourceTier;
  source_title: string;
  source_url: string;
  source_type: string;
  publication_year: number | string;
  exact_support: string;
  support_level: SupportLevel;

  // Paper Contribution vs Related Concept
  paper_contribution_vs_related?: "paper_contribution" | "related_concept" | "background" | undefined;
  is_creator_of_method?: boolean | undefined;

  // Metric Semantics & Precision
  original_metric_wording?: string | undefined;
  metric_name?: string | undefined;
  metric_definition?: string | undefined;

  // Experimental & System Context (Hard Rule: Never infer)
  model?: string | undefined;
  dataset?: string | undefined;
  task?: string | undefined;
  metric?: string | undefined;
  reported_result?: string | undefined;
  baseline?: string | undefined;
  hardware?: string | undefined;
  hardware_reported?: boolean | undefined;
  experimental_context?: string | undefined;
  evidence_level?: EvidenceLevel | undefined;

  // Mathematical Fidelity
  math_formulation_type?: MathematicalFormulationType | undefined;
  math_equation?: string | undefined;

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
  metricDriftDetected: boolean;
  baselineSpecified: boolean;
  modelSpecified: boolean;
  datasetSpecified: boolean;
  hardwareReported: boolean;
  inventedHardwareDetected: boolean;
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
  wrongPaperAttributionCount: number;
  citationEntailmentRatio: number;
  auditItems: Array<{
    claimSnippet: string;
    sourceId: string;
    sourceTitle: string;
    sourceUrl: string;
    status: VerificationStatus;
    supportLevel: SupportLevel;
    reason: string;
  }>;
}

export interface AdversarialReviewResult {
  overallAssessment: "ACCEPT" | "REVISE" | "REJECT_UNSUPPORTED";
  identifiedWeaknesses: Array<{
    claimId?: string | undefined;
    dimension: string;
    issue: string;
    recommendedCorrection: string;
    severity: "CRITICAL" | "MAJOR" | "MINOR";
  }>;
  unsupportedClaimsToPrune: string[];
  absoluteClaimsToCalibrate: Array<{ original: string; calibrated: string }>;
  uncalibratedComparisons: string[];
  inventedContextsToCleanse: string[];
  wrongPaperAttributions: Array<{ claim: string; wrongSource: string; canonicalSourceNeeded: string }>;
  revisedReport?: string | undefined;
}

export interface ResearchQualityMetrics {
  totalClaims: number;
  verifiedClaimsCount: number;
  verifiedClaimsRatio: number;
  tier1And2SourcesRatio: number;
  
  // Weighted Quality Pillars
  citationCorrectnessScore: number; // 20%
  claimEvidenceSupportScore: number; // 20%
  sourceIdentityMetadataScore: number; // 15%
  numericalMetricAccuracyScore: number; // 10%
  researchGapValidityScore: number; // 10%
  comparativeValidityScore: number; // 10%
  sourceQualityScore: number; // 5%
  contradictionCoverageScore: number; // 5%
  uncertaintyCalibrationScore: number; // 5%

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
