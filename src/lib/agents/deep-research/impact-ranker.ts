import type {
  ConfidenceLevel,
  ImpactDimensions,
  ImpactScore,
  RankedCandidate,
} from "./types";

export const IMPACT_WEIGHTS = {
  technicalNovelty: 0.2,
  capabilityImprovement: 0.2,
  realWorldAdoption: 0.2,
  economicIndustryImpact: 0.15,
  researchSignificance: 0.1,
  breadthOfImpact: 0.1,
  evidenceQuality: 0.05,
};

/**
 * Calculates weighted impact score strictly according to explicit dimensions.
 */
export function calculateImpactScore(dimensions: ImpactDimensions): ImpactScore {
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
  dates: {
    releaseDate?: string;
    adoptionDate?: string;
  };
  dimensions: ImpactDimensions;
  confidenceLevel: ConfidenceLevel;
  primaryEvidenceQuote: string;
  supportingLedgerEntryIds: string[];
  limitations: string;
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
      if (item.dimensions.realWorldAdoption < 6.0) {
        exclusionReason = `Lower real-world production adoption (${item.dimensions.realWorldAdoption}/10) compared to top ${topCount} ranked items.`;
      } else if (item.dimensions.economicIndustryImpact < 6.0) {
        exclusionReason = `More concentrated industry scope with lower direct economic market impact (${item.dimensions.economicIndustryImpact}/10).`;
      } else {
        exclusionReason = `High technical merit, but edged out by broader systemic breakthroughs (Score: ${item.impactScore.totalScore} vs #${topCount} threshold).`;
      }
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
      includedInTopRanking,
      exclusionReason,
    };
  });
}
