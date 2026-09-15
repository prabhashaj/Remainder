import type {
  ConfidenceLevel,
  DynamicEvaluationDimension,
  GenericDateClassification,
  ImpactDimensions,
  ImpactScore,
  RankedCandidate,
} from "./types";

export const IMPACT_WEIGHTS: Record<keyof ImpactDimensions, number> = {
  technicalNovelty: 0.2,
  capabilityImprovement: 0.2,
  realWorldAdoption: 0.2,
  economicIndustryImpact: 0.15,
  researchSignificance: 0.1,
  breadthOfImpact: 0.1,
  evidenceQuality: 0.05,
};

/**
 * Calculates weighted impact score either from legacy ImpactDimensions or dynamic dimensions array.
 */
export function calculateImpactScore(
  dimensions: ImpactDimensions | DynamicEvaluationDimension[],
): ImpactScore {
  if (Array.isArray(dimensions)) {
    let total = 0;
    let weightSum = 0;

    for (const dim of dimensions) {
      total += dim.score * dim.weight;
      weightSum += dim.weight;
    }

    const normalizedTotal = weightSum > 0 ? total / weightSum : total;
    return {
      dimensions,
      totalScore: Math.round(normalizedTotal * 100) / 100,
    };
  }

  // Legacy ImpactDimensions
  const total =
    dimensions.technicalNovelty * IMPACT_WEIGHTS.technicalNovelty +
    dimensions.capabilityImprovement * IMPACT_WEIGHTS.capabilityImprovement +
    dimensions.realWorldAdoption * IMPACT_WEIGHTS.realWorldAdoption +
    dimensions.economicIndustryImpact * IMPACT_WEIGHTS.economicIndustryImpact +
    dimensions.researchSignificance * IMPACT_WEIGHTS.researchSignificance +
    dimensions.breadthOfImpact * IMPACT_WEIGHTS.breadthOfImpact +
    dimensions.evidenceQuality * IMPACT_WEIGHTS.evidenceQuality;

  return {
    dimensions,
    totalScore: Math.round(total * 100) / 100,
  };
}

export interface CandidateEvaluationInput {
  name: string;
  domain: string;
  whatChanged: string;
  whyItMatters: string;
  technicalSignificance: string;
  realWorldImpact: string;
  dates: GenericDateClassification | {
    releaseDate?: string;
    adoptionDate?: string;
  };
  dimensions: ImpactDimensions | DynamicEvaluationDimension[];
  confidenceLevel: ConfidenceLevel;
  primaryEvidenceQuote: string;
  supportingLedgerEntryIds: string[];
  limitations: string;
  counterEvidenceFound?: string | undefined;
}

/**
 * Generates an explicit, domain-agnostic rationale for why a candidate was excluded from top ranking.
 */
function deriveExclusionReason(
  dimensions: ImpactDimensions | DynamicEvaluationDimension[],
  topCount: number,
  totalScore: number,
): string {
  if (Array.isArray(dimensions)) {
    // Find the dimension with the lowest score
    const sorted = [...dimensions].sort((a, b) => a.score - b.score);
    const lowest = sorted[0];
    if (lowest && lowest.score < 6.5) {
      return `Lower score in ${lowest.name} (${lowest.score}/10) compared to top ${topCount} threshold.`;
    }
    return `High overall merit, but edged out by broader systemic solutions (Score: ${totalScore} vs #${topCount} cutoff).`;
  }

  // Legacy dimensions
  if (dimensions.realWorldAdoption < 6.0) {
    return `Lower real-world production adoption (${dimensions.realWorldAdoption}/10) compared to top ${topCount} ranked items.`;
  }
  if (dimensions.economicIndustryImpact < 6.0) {
    return `More concentrated industry scope with lower direct economic market impact (${dimensions.economicIndustryImpact}/10).`;
  }
  if (dimensions.technicalNovelty < 6.0) {
    return `Incremental advancement rather than structural paradigm shift (${dimensions.technicalNovelty}/10).`;
  }

  return `High technical merit, but edged out by broader systemic breakthroughs (Score: ${totalScore} vs #${topCount} threshold).`;
}

/**
 * Ranks candidates by total weighted score and determines top ranking vs exclusions.
 */
export function rankCandidates(
  candidates: CandidateEvaluationInput[],
  topCount = 5,
): RankedCandidate[] {
  // Sort descending by totalScore
  const scored = candidates.map((cand) => {
    const impactScore = calculateImpactScore(cand.dimensions);
    return {
      ...cand,
      impactScore,
    };
  });

  scored.sort((a, b) => b.impactScore.totalScore - a.impactScore.totalScore);

  return scored.map((item, index) => {
    const rank = index + 1;
    const includedInTopRanking = rank <= topCount;

    let exclusionReason: string | undefined = undefined;
    if (!includedInTopRanking) {
      exclusionReason = deriveExclusionReason(
        item.dimensions,
        topCount,
        item.impactScore.totalScore,
      );
    }

    return {
      rank,
      candidateName: item.name,
      domain: item.domain,
      whatChanged: item.whatChanged,
      whyItMatters: item.whyItMatters,
      technicalSignificance: item.technicalSignificance,
      realWorldImpact: item.realWorldImpact,
      dates: item.dates,
      impactScore: item.impactScore,
      confidenceLevel: item.confidenceLevel,
      primaryEvidenceQuote: item.primaryEvidenceQuote,
      supportingLedgerEntryIds: item.supportingLedgerEntryIds,
      limitations: item.limitations,
      counterEvidenceFound: item.counterEvidenceFound,
      includedInTopRanking,
      exclusionReason,
    };
  });
}
