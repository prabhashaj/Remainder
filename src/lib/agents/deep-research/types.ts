export type SourceTier = 1 | 2 | 3 | 4;

export type SourceType =
  | "official_primary"
  | "official_company"
  | "academic_paper"
  | "government_regulatory"
  | "independent_benchmark"
  | "technical_publication"
  | "industry_analysis"
  | "news_report"
  | "blog"
  | "forum_social"
  | "other";

export type SupportDirectness =
  | "DIRECT_SUPPORT"
  | "INDIRECT_SUPPORT"
  | "CONTEXTUAL_SUPPORT"
  | "NO_SUPPORT";

export type ClaimType =
  | "fact"
  | "interpretation"
  | "inference"
  | "forecast"
  | "opinion";

export type ConfidenceLevel = "green" | "yellow" | "orange" | "red";

export type DateStatus = "known" | "approximate" | "unknown";

export type TemporalStatus =
  | "valid"
  | "rejected_out_of_window"
  | "pre_window_baseline"
  | "unspecified";

export type ResearchIntent =
  | "comparison"
  | "verification"
  | "historical_cause"
  | "ranking"
  | "landscape"
  | "strategic_analysis"
  | "general";

export type OutputFormat =
  | "comparison"
  | "causal_investigation"
  | "ranking"
  | "scientific_verification"
  | "strategic_analysis"
  | "general_report";

export type CausalClassification =
  | "CORRELATION"
  | "CAUSATION"
  | "MECHANISTIC"
  | "TEMPORAL_SEQUENCE"
  | "SPECULATION";

export type VerificationFailureTaxonomy =
  | "NO_SOURCE_EXISTS"
  | "RETRIEVAL_FAILED"
  | "EXTRACTION_FAILED"
  | "CONTRADICTION_REMAINS"
  | "CLAIM_UNSUPPORTED";

export interface TemporalScope {
  mode: "between" | "before" | "after" | "as_of" | "latest" | "historical" | "open";
  startDate?: string | undefined;
  endDate?: string | undefined; // Authoritative cutoff when specified
  cutoffPolicy: "strict" | "retrospective_allowed";
  targetTimeframeDescription?: string | undefined;
}

export interface ResearchTask {
  question: string;
  objective: string;
  intent: ResearchIntent;
  entities: string[];
  scopeDescription: string;
  temporalScope: TemporalScope;
  geographicScope?: string | undefined;
  domains: string[];
  comparisonDimensions: string[];
  rankingRequired: boolean;
  evidenceRequirements: string[];
  outputFormat: OutputFormat;
  topic?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  geography?: string | undefined;
}

// Backwards compatibility alias
export type ResearchScope = ResearchTask;

export interface SourceEvaluation {
  authority: number; // 0.0 to 10.0
  directness: SupportDirectness;
  independence: number; // 0.0 to 10.0
  methodologicalQuality: number; // 0.0 to 10.0
  recency: number; // 0.0 to 10.0
  reproducibility: number; // 0.0 to 10.0
}

export interface SourceMetadata {
  id: string;
  url: string;
  canonicalUrl?: string | undefined;
  title: string;
  publisher: string;
  authors?: string[] | undefined;
  publicationDate: string | null; // Strictly null if unknown (Never a fake date)
  sourceUpdatedDate?: string | null | undefined;
  dateStatus: DateStatus;
  sourceType: SourceType;
  sourceTier: SourceTier;
  primarySource: boolean;
  independenceGroup: string; // Used to group syndicated PR/reposts together
  rawSnippet?: string | undefined;
  evaluation?: SourceEvaluation | undefined;
}

export interface GenericDateClassification {
  sourcePublicationDate?: string | null | undefined;
  sourceUpdatedDate?: string | null | undefined;
  eventDate?: string | null | undefined;
  effectiveDate?: string | null | undefined;
  announcementDate?: string | null | undefined;
  releaseDate?: string | null | undefined;
  adoptionDate?: string | null | undefined;
  impactDate?: string | null | undefined;
  researchPaperDate?: string | null | undefined;
}

export type DateClassification = GenericDateClassification;

export interface QuantitativeData {
  value?: string | undefined;
  rawValue?: string | number | undefined;
  numericValue?: number | undefined;
  unit: string;
  category: "percentage" | "multiplier" | "currency" | "count" | "rate" | "dimension" | "score" | "other";
  direction?: "increase" | "decrease" | "neutral" | undefined;
  baseline?: string | undefined; // What is it compared against?
  comparison?: string | undefined;
  measurementMethod?: string | undefined;
  conditions?: string | undefined;
  measurementConditions?: string | undefined;
  sampleOrPopulation?: string | undefined;
  isBestCaseOnly?: boolean | undefined;
}

// Backwards compatibility alias
export type NumericalData = QuantitativeData;

export interface CausalValidation {
  isCausalClaim: boolean;
  classification: CausalClassification;
  causalVerbsFound: string[];
  supportedByDirectEvidence: boolean;
  alternativeExplanations?: string[] | undefined;
  suggestedWording?: string | undefined;
}

export interface AtomicClaim {
  id: string;
  claim: string;
  claimType: ClaimType;
  entityName?: string | undefined;
  canonicalEntity?: string | undefined;
  dates: GenericDateClassification;
  quantitative?: QuantitativeData | undefined;
  numerical?: QuantitativeData | undefined; // Alias
  causal?: CausalValidation | undefined;
}

export interface EvidenceLedgerEntry {
  id: string;
  claim: string;
  claimType: ClaimType;
  canonicalEntity?: string | undefined;
  sources: SourceMetadata[];
  primarySource?: SourceMetadata | undefined;
  publicationDate?: string | null | undefined;
  dates: GenericDateClassification;
  evidenceQuoteOrExcerpt: string;
  sourceTier: SourceTier;
  directness: SupportDirectness;
  corroborationCount: number;
  independentSourceCount: number; // Counts distinct independenceGroups
  contradictions: string[];
  counterEvidence: string[];
  disconfirmationSearched: boolean;
  temporalStatus: TemporalStatus;
  importanceScore: number; // 0.0 to 10.0 (Distinct from confidence)
  confidenceScore: number; // 0.0 to 10.0
  confidenceLevel: ConfidenceLevel;
  quantitative?: QuantitativeData | undefined;
  numerical?: QuantitativeData | undefined;
  causal?: CausalValidation | undefined;
  failureReason?: VerificationFailureTaxonomy | undefined;
  verificationNotes?: string | undefined;
}

export interface EvidenceLedger {
  entries: EvidenceLedgerEntry[];
  unverifiedClaims: Array<{ claim: string; reason: VerificationFailureTaxonomy; details?: string }>;
  rejectedSources: Array<{ source: SourceMetadata; reason: string }>;
  contradictions: ContradictionRecord[];
  counterEvidenceFound: Array<{ conclusion: string; counterEvidence: string; source: SourceMetadata }>;
}

export interface ContradictionRecord {
  topicOrEntity: string;
  claimA: { statement: string; source: SourceMetadata; tier: SourceTier };
  claimB: { statement: string; source: SourceMetadata; tier: SourceTier };
  discrepancyType: "numerical" | "temporal" | "entity" | "factual" | "causal";
  resolution?: string | undefined;
  resolutionConfidence?: number | undefined;
}

export interface DynamicEvaluationDimension {
  name: string;
  weight: number; // 0.0 to 1.0 (Sum = 1.0)
  description: string;
  score: number; // 0.0 to 10.0
}

export interface DynamicImpactScore {
  dimensions: DynamicEvaluationDimension[];
  totalScore: number; // 0.0 to 10.0
  importanceScore: number; // 0.0 to 10.0
  confidenceScore: number; // 0.0 to 10.0
}

// Backwards compatibility alias
export interface ImpactDimensions {
  technicalNovelty: number;
  capabilityImprovement: number;
  realWorldAdoption: number;
  economicIndustryImpact: number;
  researchSignificance: number;
  breadthOfImpact: number;
  evidenceQuality: number;
}

export interface ImpactScore {
  dimensions: ImpactDimensions | DynamicEvaluationDimension[];
  totalScore: number;
}

export interface RankedCandidate {
  rank: number;
  candidateName: string;
  domain: string;
  whatChanged: string;
  whyItMatters: string;
  technicalSignificance: string;
  realWorldImpact: string;
  dates: GenericDateClassification;
  impactScore: ImpactScore;
  confidenceLevel: ConfidenceLevel;
  primaryEvidenceQuote: string;
  supportingLedgerEntryIds: string[];
  limitations: string;
  counterEvidenceFound?: string | undefined;
  includedInTopRanking: boolean;
  exclusionReason?: string | undefined;
}

export interface ResearchQualityMetrics {
  evidenceCoverageRate: number; // supported important claims / total important claims
  citationGroundingRate: number; // grounded citations / total citations
  temporalComplianceRate: number; // valid time-scoped evidence / total time-scoped evidence
  primarySourceUtilization: number; // claims backed by primary source / total claims needing primary
  contradictionDetectionRate: number;
  unsupportedClaimRate: number; // unsupported claims / total claims
  sourceIndependenceScore: number; // independent sources / total sources
  researchCompletenessScore: number; // 0.0 to 10.0
}

export interface AuditCheckResult {
  passed: boolean;
  name: string;
  details: string;
  violations?: string[] | undefined;
}

export interface ResearchAuditReport {
  overallPassed: boolean;
  qualityGatesPassed: boolean;
  metrics: ResearchQualityMetrics;
  checks: {
    unsupportedClaims: AuditCheckResult;
    weakCitations: AuditCheckResult;
    citationMismatch: AuditCheckResult;
    temporalViolations: AuditCheckResult;
    dateConfusion: AuditCheckResult;
    numericalContext: AuditCheckResult;
    unsupportedCausalClaims: AuditCheckResult;
    unresolvedContradictions: AuditCheckResult;
    entityConfusion: AuditCheckResult;
    overstatedCertainty: AuditCheckResult;
    missingCounterEvidence: AuditCheckResult;
    rankingConsistency: AuditCheckResult;
    scopeDrift: AuditCheckResult;
    duplicateSources: AuditCheckResult;
    irrelevantReferences: AuditCheckResult;
    actualQuestionAddressed: AuditCheckResult;
  };
  // Backwards compatibility aliases
  temporalAudit: AuditCheckResult;
  sourceAudit: AuditCheckResult;
  claimAudit: AuditCheckResult;
  numericalAudit: AuditCheckResult;
  causalAudit: AuditCheckResult;
  entityAudit: AuditCheckResult;
  contradictionAudit: AuditCheckResult;
  rankingAudit: AuditCheckResult;
  citationAudit: AuditCheckResult;
  bibliographyAudit: AuditCheckResult;
  uncertaintyAudit: AuditCheckResult;
  auditSummary: string;
  recommendedAction: "PROCEED_TO_PUBLISH" | "RETURN_TO_RESEARCH";
}

export interface ProvenanceStep {
  step: string;
  query?: string | undefined;
  sourcesFound?: number | undefined;
  sourcesSelected?: string[] | undefined;
  claimsExtracted?: number | undefined;
  verificationOutcome?: string | undefined;
  confidence?: ConfidenceLevel | undefined;
  importanceScore?: number | undefined;
  impactScore?: number | undefined;
  finalSentenceSummary?: string | undefined;
  citationsAssigned?: string[] | undefined;
}

export interface ResearchProvenanceTrace {
  question: string;
  task: ResearchTask;
  scope?: ResearchTask | undefined; // Alias
  provenanceTrail: ProvenanceStep[];
  metrics?: ResearchQualityMetrics | undefined;
}
