export type SourceTier = 1 | 2 | 3 | 4;

export type SourceType =
  | "official_company"
  | "paper"
  | "government"
  | "independent"
  | "blog"
  | "social"
  | "other";

export type ClaimType = "fact" | "interpretation" | "forecast";

export type ConfidenceLevel = "green" | "yellow" | "orange" | "red";

export type TemporalStatus =
  | "valid"
  | "rejected_out_of_window"
  | "pre_window_baseline"
  | "unspecified";

export interface ResearchScope {
  topic: string;
  startDate?: string | undefined; // ISO date or YYYY-MM-DD
  endDate?: string | undefined; // ISO date or YYYY-MM-DD (authoritative cutoff)
  geography?: string | undefined;
  domains: string[];
  researchQuestion: string;
  rankingRequired: boolean;
}

export interface SourceMetadata {
  url: string;
  title: string;
  sourceType: SourceType;
  sourceTier: SourceTier;
  publisher: string;
  publicationDate?: string | undefined; // YYYY-MM-DD or ISO
  primarySource: boolean;
  rawSnippet?: string | undefined;
}

export interface DateClassification {
  announcementDate?: string | undefined;
  releaseDate?: string | undefined;
  availabilityDate?: string | undefined;
  researchPaperDate?: string | undefined;
  deploymentDate?: string | undefined;
  adoptionDate?: string | undefined;
  impactDate?: string | undefined;
  sourcePublicationDate?: string | undefined;
}

export interface NumericalData {
  value: string | number;
  unit: string;
  baseline?: string | undefined; // e.g. "compared to GPT-4o"
  comparison?: string | undefined; // e.g. "faster", "cheaper"
  measurementConditions?: string | undefined; // e.g. "measured on HumanEval with temperature 0.2"
  hardware?: string | undefined;
  isBestCaseOnly?: boolean | undefined;
}

export interface CausalValidation {
  isCausalClaim: boolean;
  causalVerbsFound: string[];
  supportedByDirectEvidence: boolean;
  suggestedWording?: string | undefined;
}

export interface AtomicClaim {
  id: string;
  claim: string;
  claimType: ClaimType;
  entityName?: string | undefined;
  entityVersion?: string | undefined;
  canonicalEntity?: string | undefined;
  dates: DateClassification;
  numerical?: NumericalData | undefined;
  causal?: CausalValidation | undefined;
}

export interface EvidenceLedgerEntry {
  id: string;
  claim: string;
  claimType: ClaimType;
  canonicalEntity?: string | undefined;
  sources: SourceMetadata[];
  primarySource?: SourceMetadata | undefined;
  publicationDate?: string | undefined;
  dates: DateClassification;
  evidenceQuoteOrExcerpt: string;
  sourceTier: SourceTier;
  corroborationCount: number;
  contradictions: string[];
  temporalStatus: TemporalStatus;
  confidenceScore: number; // 0.0 to 1.0
  confidenceLevel: ConfidenceLevel;
  numerical?: NumericalData | undefined;
  causal?: CausalValidation | undefined;
  verificationNotes?: string | undefined;
}

export interface EvidenceLedger {
  entries: EvidenceLedgerEntry[];
  unverifiedClaims: string[];
  rejectedSources: Array<{ source: SourceMetadata; reason: string }>;
  contradictions: ContradictionRecord[];
}

export interface ContradictionRecord {
  topicOrEntity: string;
  claimA: { statement: string; source: SourceMetadata; tier: SourceTier };
  claimB: { statement: string; source: SourceMetadata; tier: SourceTier };
  discrepancyType: "numerical" | "temporal" | "entity" | "factual";
  resolution?: string | undefined; // e.g. "Primary source A preferred over secondary source B"
}

export interface ImpactDimensions {
  technicalNovelty: number; // 0-10 (weight: 20%)
  capabilityImprovement: number; // 0-10 (weight: 20%)
  realWorldAdoption: number; // 0-10 (weight: 20%)
  economicIndustryImpact: number; // 0-10 (weight: 15%)
  researchSignificance: number; // 0-10 (weight: 10%)
  breadthOfImpact: number; // 0-10 (weight: 10%)
  evidenceQuality: number; // 0-10 (weight: 5%)
}

export interface ImpactScore {
  dimensions: ImpactDimensions;
  totalScore: number; // 0.0 to 10.0
}

export interface RankedCandidate {
  rank: number;
  candidateName: string;
  domain: string;
  whatChanged: string;
  whyItMatters: string;
  technicalSignificance: string;
  realWorldImpact: string;
  dates: DateClassification;
  impactScore: ImpactScore;
  confidenceLevel: ConfidenceLevel;
  primaryEvidenceQuote: string;
  supportingLedgerEntryIds: string[];
  limitations: string;
  includedInTopRanking: boolean;
  exclusionReason?: string | undefined;
}

export interface AuditCheckResult {
  passed: boolean;
  name: string;
  details: string;
  violations?: string[] | undefined;
}

export interface ResearchAuditReport {
  overallPassed: boolean;
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
}

export interface ProvenanceStep {
  step: string;
  query?: string | undefined;
  sourcesFound?: number | undefined;
  sourcesSelected?: string[] | undefined;
  claimsExtracted?: number | undefined;
  verificationOutcome?: string | undefined;
  confidence?: ConfidenceLevel | undefined;
  impactScore?: number | undefined;
  finalSentenceSummary?: string | undefined;
  citationsAssigned?: string[] | undefined;
}

export interface ResearchProvenanceTrace {
  question: string;
  scope: ResearchScope;
  provenanceTrail: ProvenanceStep[];
}
