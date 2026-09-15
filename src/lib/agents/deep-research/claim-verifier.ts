import type {
  AtomicClaim,
  ConfidenceLevel,
  ContradictionRecord,
  EvidenceLedgerEntry,
  SourceMetadata,
  SourceTier,
  SupportDirectness,
  TemporalStatus,
  VerificationFailureTaxonomy,
} from "./types";
import { compareSourceQuality } from "./source-evaluator";

/**
 * Checks if a candidate source excerpt directly supports an atomic claim.
 * Evaluates support directness: DIRECT_SUPPORT vs INDIRECT_SUPPORT vs CONTEXTUAL_SUPPORT vs NO_SUPPORT.
 */
export function isClaimSupportedBySource(
  claim: AtomicClaim,
  source: SourceMetadata,
): { supported: boolean; directness: SupportDirectness; matchedExcerpt: string } {
  const snippet = `${source.title} ${source.rawSnippet || ""}`.toLowerCase();
  const claimText = claim.claim.toLowerCase();

  // 1. If claim contains numerical metrics, verify the number appears in the snippet
  const numData = claim.quantitative || claim.numerical;
  if (numData && numData.value) {
    const rawVal = String(numData.value).toLowerCase().replace(/%/g, "").trim();
    // Also check clean numeric string if available
    const numericStr = numData.numericValue !== undefined ? String(numData.numericValue) : "";
    const hasNum = snippet.includes(rawVal) || (numericStr && snippet.includes(numericStr));

    if (!hasNum) {
      // If the number doesn't match at all, it cannot directly support
      // Check if it at least provides contextual support for the entity/topic
      const stopWords = new Set([
        "the", "a", "an", "is", "was", "are", "were", "and", "or", "in", "on",
        "at", "to", "for", "with", "by", "from", "that", "this", "it", "as",
      ]);

      function tokenMatches(token: string, targetText: string): boolean {
        if (targetText.includes(token)) return true;
        if (token.length >= 4) {
          const stem = token.slice(0, token.length - 2);
          if (targetText.includes(stem)) return true;
        }
        return false;
      }

      const claimTokens = claimText
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter(
          (t) =>
            t.length > 2 &&
            !stopWords.has(t) &&
            !/\d/.test(t) &&
            !["wh", "kg", "mg", "ppm", "flops", "params"].includes(t),
        );
      const matches = claimTokens.filter((t) => tokenMatches(t, snippet));
      if (matches.length / (claimTokens.length || 1) >= 0.35) {
        return {
          supported: false,
          directness: "CONTEXTUAL_SUPPORT",
          matchedExcerpt: source.rawSnippet ? source.rawSnippet.slice(0, 300) : source.title,
        };
      }
      return { supported: false, directness: "NO_SUPPORT", matchedExcerpt: "" };
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
    return { supported: false, directness: "NO_SUPPORT", matchedExcerpt: "" };
  }

  function tokenMatches(token: string, targetText: string): boolean {
    if (targetText.includes(token)) return true;
    if (token.length >= 4) {
      const stem = token.slice(0, token.length - 2);
      if (targetText.includes(stem)) return true;
    }
    return false;
  }

  const matchingTokens = claimTokens.filter((t) => tokenMatches(t, snippet));
  const overlapRatio = matchingTokens.length / claimTokens.length;

  const excerpt = source.rawSnippet ? source.rawSnippet.slice(0, 350) : source.title;

  if (overlapRatio >= 0.5) {
    return {
      supported: true,
      directness: "DIRECT_SUPPORT",
      matchedExcerpt: excerpt,
    };
  }

  if (overlapRatio >= 0.35) {
    return {
      supported: true,
      directness: "INDIRECT_SUPPORT",
      matchedExcerpt: excerpt,
    };
  }

  if (overlapRatio >= 0.2) {
    return {
      supported: false,
      directness: "CONTEXTUAL_SUPPORT",
      matchedExcerpt: excerpt,
    };
  }

  return { supported: false, directness: "NO_SUPPORT", matchedExcerpt: "" };
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
  // Check parameter count contradiction: e.g. "500B" vs "671B"
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
        : pref > 0
          ? `Primary source '${sourceB.publisher}' (${numB[0]}) preferred over '${sourceA.publisher}' (${numA[0]}).`
          : `Evidence is conflicting between ${sourceA.publisher} (${numA[0]}) and ${sourceB.publisher} (${numB[0]}).`;

    return {
      topicOrEntity: topic,
      claimA: { statement: statementA, source: sourceA, tier: sourceA.sourceTier },
      claimB: { statement: statementB, source: sourceB, tier: sourceB.sourceTier },
      discrepancyType: "numerical",
      resolution,
    };
  }

  // Generic numeric with units: e.g. "450 Wh/kg" vs "300 Wh/kg", "$700 billion" vs "$500 billion"
  const unitRegex = /(\d+(?:\.\d+)?)\s*(?:billion|million|trillion|Wh\/kg|mg\/L)/i;
  const unitA = unitRegex.exec(statementA);
  const unitB = unitRegex.exec(statementB);
  if (unitA && unitB && unitA[1] !== unitB[1]) {
    const pref = compareSourceQuality(sourceA, sourceB);
    const resolution =
      pref < 0
        ? `Primary source '${sourceA.publisher}' (${unitA[0]}) preferred over '${sourceB.publisher}' (${unitB[0]}).`
        : pref > 0
          ? `Primary source '${sourceB.publisher}' (${unitB[0]}) preferred over '${sourceA.publisher}' (${unitA[0]}).`
          : `Conflicting metrics: ${sourceA.publisher} states ${unitA[0]} while ${sourceB.publisher} states ${unitB[0]}.`;

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
 * Principle 3: Counts distinct independence groups (not duplicated syndication).
 * Principle 4: Separates confidence from importance.
 */
export function calculateConfidence(params: {
  bestTier: SourceTier;
  corroborationCount: number;
  independentSourceCount?: number | undefined;
  hasContradictions: boolean;
  temporalStatus: TemporalStatus;
  hasBaselineIfNumerical: boolean;
  directness?: SupportDirectness | undefined;
  hasCounterEvidence?: boolean | undefined;
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

  // Independence corroboration bonus
  const indCount = params.independentSourceCount ?? params.corroborationCount;
  if (indCount >= 3) score += 0.15;
  else if (indCount >= 2) score += 0.1;
  else if (indCount === 1) score += 0.05;

  // Support directness modifier
  if (params.directness === "DIRECT_SUPPORT") score += 0.05;
  else if (params.directness === "INDIRECT_SUPPORT") score -= 0.05;
  else if (params.directness === "CONTEXTUAL_SUPPORT") score -= 0.25;

  // Counter-evidence penalty
  if (params.hasCounterEvidence) {
    score -= 0.2;
  }

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
 * Calculates claim importance score (0.0 to 10.0) independently of confidence.
 * Based on whether it provides quantitative metrics, architectural/systemic mechanisms,
 * headline factual answers to the objective, or secondary details.
 */
export function calculateImportanceScore(claim: AtomicClaim): number {
  let score = 5.0;

  // Facts with quantitative empirical data are high importance
  if (claim.quantitative || claim.numerical) {
    score += 2.0;
    if (claim.quantitative?.baseline || claim.numerical?.baseline) {
      score += 1.0;
    }
  }

  // Mechanistic / Causal explanations are high importance
  if (claim.causal?.isCausalClaim) {
    score += 1.5;
  }

  // Headline facts
  if (claim.claimType === "fact") {
    score += 0.5;
  } else if (claim.claimType === "forecast") {
    score -= 0.5;
  }

  return Math.min(Math.max(Math.round(score * 10) / 10, 1.0), 10.0);
}

/**
 * Builds a verified EvidenceLedgerEntry for a validated claim.
 */
export function createLedgerEntry(params: {
  claim: AtomicClaim;
  supportingSources: SourceMetadata[];
  contradictions: ContradictionRecord[];
  temporalStatus: TemporalStatus;
  counterEvidence?: string[] | undefined;
  failureReason?: VerificationFailureTaxonomy | undefined;
}): EvidenceLedgerEntry {
  const {
    claim,
    supportingSources,
    contradictions,
    temporalStatus,
    counterEvidence = [],
    failureReason,
  } = params;

  const importanceScore = calculateImportanceScore(claim);

  if (supportingSources.length === 0) {
    return {
      id: claim.id,
      claim: claim.claim,
      claimType: claim.claimType,
      sources: [],
      dates: claim.dates,
      evidenceQuoteOrExcerpt: "",
      sourceTier: 4,
      directness: "NO_SUPPORT",
      corroborationCount: 0,
      independentSourceCount: 0,
      contradictions: [],
      counterEvidence,
      disconfirmationSearched: true,
      temporalStatus: "unspecified",
      importanceScore,
      confidenceScore: 0.1,
      confidenceLevel: "red",
      quantitative: claim.quantitative || claim.numerical,
      numerical: claim.numerical || claim.quantitative,
      causal: claim.causal,
      failureReason: failureReason || "CLAIM_UNSUPPORTED",
      verificationNotes: "I could not verify this claim. No reliable sources found.",
    };
  }

  // Sort sources by quality to pick the primary source
  const sorted = [...supportingSources].sort(compareSourceQuality);
  const primarySource = sorted[0];
  const bestTier = primarySource ? primarySource.sourceTier : 4;

  // Count distinct independence groups
  const distinctGroups = new Set(supportingSources.map((s) => s.independenceGroup || s.publisher));
  const independentSourceCount = distinctGroups.size;

  const contradictionNotes = contradictions.map((c) => c.resolution || "Discrepancy detected");
  const hasContradictions = contradictions.length > 0;

  const numData = claim.quantitative || claim.numerical;
  const hasBaselineIfNumerical = !numData || Boolean(numData.baseline);

  // Check directness against primary source
  const directnessCheck = primarySource
    ? isClaimSupportedBySource(claim, primarySource)
    : { supported: true, directness: "DIRECT_SUPPORT" as SupportDirectness, matchedExcerpt: "" };

  const { score, level } = calculateConfidence({
    bestTier,
    corroborationCount: supportingSources.length,
    independentSourceCount,
    hasContradictions,
    temporalStatus,
    hasBaselineIfNumerical,
    directness: directnessCheck.directness,
    hasCounterEvidence: counterEvidence.length > 0,
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
      directnessCheck.matchedExcerpt ||
      primarySource?.rawSnippet?.slice(0, 300) ||
      primarySource?.title ||
      "",
    sourceTier: bestTier,
    directness: directnessCheck.directness,
    corroborationCount: supportingSources.length,
    independentSourceCount,
    contradictions: contradictionNotes,
    counterEvidence,
    disconfirmationSearched: true,
    temporalStatus,
    importanceScore,
    confidenceScore: score,
    confidenceLevel: level,
    quantitative: numData,
    numerical: numData,
    causal: claim.causal,
    verificationNotes:
      level === "red"
        ? "Claim unverified or conflicting."
        : `Verified via ${primarySource?.publisher} (Tier ${bestTier}) with ${supportingSources.length} source(s) (${independentSourceCount} independent).`,
  };
}
