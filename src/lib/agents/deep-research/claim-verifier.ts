import type {
  AtomicClaim,
  ConfidenceLevel,
  ContradictionRecord,
  EvidenceLedgerEntry,
  SourceMetadata,
  SourceTier,
  TemporalStatus,
} from "./types";
import { compareSourceQuality } from "./source-evaluator";

/**
 * Checks if a candidate source excerpt directly supports an atomic claim.
 * Performs deterministic token overlap & entity matching.
 */
export function isClaimSupportedBySource(
  claim: AtomicClaim,
  source: SourceMetadata,
): { supported: boolean; matchedExcerpt: string } {
  const snippet = `${source.title} ${source.rawSnippet || ""}`.toLowerCase();
  const claimText = claim.claim.toLowerCase();

  // 1. If claim contains numerical metrics, verify the number appears in the snippet
  if (claim.numerical) {
    const rawVal = String(claim.numerical.value).toLowerCase().replace(/%/g, "");
    if (!snippet.includes(rawVal)) {
      return { supported: false, matchedExcerpt: "" };
    }
  }

  // 2. Token overlap check
  const stopWords = new Set([
    "the", "a", "an", "is", "was", "are", "were", "and", "or", "in", "on",
    "at", "to", "for", "with", "by", "from", "that", "this", "it", "as",
  ]);
  const claimTokens = claimText
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !stopWords.has(t));

  if (claimTokens.length === 0) {
    return { supported: false, matchedExcerpt: "" };
  }

  const matchingTokens = claimTokens.filter((t) => snippet.includes(t));
  const overlapRatio = matchingTokens.length / claimTokens.length;

  if (overlapRatio >= 0.6) {
    // Find relevant sentence in rawSnippet
    const excerpt = source.rawSnippet ? source.rawSnippet.slice(0, 300) : source.title;
    return { supported: true, matchedExcerpt: excerpt };
  }

  return { supported: false, matchedExcerpt: "" };
}

/**
 * Detects numerical or factual contradictions between two statements about the same topic.
 */
export function detectContradictionBetweenSources(
  statementA: string,
  sourceA: SourceMetadata,
  statementB: string,
  sourceB: SourceMetadata,
  topic: string,
): ContradictionRecord | null {
  // Check parameter count contradiction: e.g. "500B" vs "700B"
  const paramRegex = /(\d+(?:\.\d+)?)\s*[BMKTPbmktp]\s*(?:params|parameters)/i;
  const paramA = paramRegex.exec(statementA);
  const paramB = paramRegex.exec(statementB);

  if (paramA && paramB && paramA[1] !== paramB[1]) {
    const pref = compareSourceQuality(sourceA, sourceB);
    const resolution =
      pref < 0
        ? `Primary source '${sourceA.publisher}' (${paramA[0]}) preferred over '${sourceB.publisher}' (${paramB[0]}).`
        : pref > 0
          ? `Primary source '${sourceB.publisher}' (${paramB[0]}) preferred over '${sourceA.publisher}' (${paramA[0]}).`
          : `Evidence is conflicting: ${sourceA.publisher} reports ${paramA[0]} while ${sourceB.publisher} reports ${paramB[0]}.`;

    return {
      topicOrEntity: topic,
      claimA: { statement: statementA, source: sourceA, tier: sourceA.sourceTier },
      claimB: { statement: statementB, source: sourceB, tier: sourceB.sourceTier },
      discrepancyType: "numerical",
      resolution,
    };
  }

  // Check percentage / speedup contradiction: e.g. "30%" vs "50%"
  const numRegex = /(\d+(?:\.\d+)?)\s*%/;
  const numA = numRegex.exec(statementA);
  const numB = numRegex.exec(statementB);
  if (numA && numB && numA[1] !== numB[1]) {
    const pref = compareSourceQuality(sourceA, sourceB);
    const resolution =
      pref < 0
        ? `Primary source '${sourceA.publisher}' (${numA[0]}) preferred over '${sourceB.publisher}' (${numB[0]}).`
        : `Evidence is conflicting between ${sourceA.publisher} (${numA[0]}) and ${sourceB.publisher} (${numB[0]}).`;

    return {
      topicOrEntity: topic,
      claimA: { statement: statementA, source: sourceA, tier: sourceA.sourceTier },
      claimB: { statement: statementB, source: sourceB, tier: sourceB.sourceTier },
      discrepancyType: "numerical",
      resolution,
    };
  }

  return null;
}

/**
 * Computes confidence score and level:
 * Green: High confidence (Tier 1/2 + direct evidence + corroboration)
 * Yellow: Moderate confidence (reliable source, single source)
 * Orange: Low confidence (Tier 3/secondary only)
 * Red: Unverified / contradictory / out-of-window
 */
export function calculateConfidence(params: {
  bestTier: SourceTier;
  corroborationCount: number;
  hasContradictions: boolean;
  temporalStatus: TemporalStatus;
  hasBaselineIfNumerical: boolean;
}): { score: number; level: ConfidenceLevel } {
  if (params.temporalStatus === "rejected_out_of_window") {
    return { score: 0.1, level: "red" };
  }
  if (params.corroborationCount === 0) {
    return { score: 0.2, level: "red" };
  }
  if (params.hasContradictions) {
    return { score: 0.35, level: "red" };
  }

  let score = 0.5;

  // Source quality contribution
  if (params.bestTier === 1) score += 0.35;
  else if (params.bestTier === 2) score += 0.25;
  else if (params.bestTier === 3) score += 0.1;

  // Corroboration contribution
  if (params.corroborationCount >= 2) score += 0.15;
  else if (params.corroborationCount === 1) score += 0.05;

  // Numerical baseline penalty if missing
  if (!params.hasBaselineIfNumerical) {
    score -= 0.15;
  }

  score = Math.min(Math.max(score, 0.0), 1.0);

  if (score >= 0.85) return { score, level: "green" };
  if (score >= 0.65) return { score, level: "yellow" };
  if (score >= 0.4) return { score, level: "orange" };
  return { score, level: "red" };
}

/**
 * Builds a verified EvidenceLedgerEntry for a validated claim.
 */
export function createLedgerEntry(params: {
  claim: AtomicClaim;
  supportingSources: SourceMetadata[];
  contradictions: ContradictionRecord[];
  temporalStatus: TemporalStatus;
}): EvidenceLedgerEntry {
  const { claim, supportingSources, contradictions, temporalStatus } = params;

  if (supportingSources.length === 0) {
    return {
      id: claim.id,
      claim: claim.claim,
      claimType: claim.claimType,
      sources: [],
      dates: claim.dates,
      evidenceQuoteOrExcerpt: "",
      sourceTier: 4,
      corroborationCount: 0,
      contradictions: [],
      temporalStatus: "unspecified",
      confidenceScore: 0.1,
      confidenceLevel: "red",
      numerical: claim.numerical,
      causal: claim.causal,
      verificationNotes: "I could not verify this claim. No reliable sources found.",
    };
  }

  // Sort sources by quality to pick the primary source
  const sorted = [...supportingSources].sort(compareSourceQuality);
  const primarySource = sorted[0];
  const bestTier = primarySource ? primarySource.sourceTier : 4;

  const contradictionNotes = contradictions.map((c) => c.resolution || "Discrepancy detected");
  const hasContradictions = contradictions.length > 0;

  const hasBaselineIfNumerical =
    !claim.numerical || Boolean(claim.numerical.baseline);

  const { score, level } = calculateConfidence({
    bestTier,
    corroborationCount: supportingSources.length,
    hasContradictions,
    temporalStatus,
    hasBaselineIfNumerical,
  });

  return {
    id: claim.id,
    claim: claim.causal?.suggestedWording || claim.claim,
    claimType: claim.claimType,
    canonicalEntity: claim.canonicalEntity,
    sources: supportingSources,
    primarySource,
    publicationDate: primarySource?.publicationDate,
    dates: claim.dates,
    evidenceQuoteOrExcerpt:
      primarySource?.rawSnippet?.slice(0, 300) || primarySource?.title || "",
    sourceTier: bestTier,
    corroborationCount: supportingSources.length,
    contradictions: contradictionNotes,
    temporalStatus,
    confidenceScore: score,
    confidenceLevel: level,
    numerical: claim.numerical,
    causal: claim.causal,
    verificationNotes:
      level === "red"
        ? "Claim unverified or conflicting."
        : `Verified via ${primarySource?.publisher} (Tier ${bestTier}) with ${supportingSources.length} source(s).`,
  };
}
