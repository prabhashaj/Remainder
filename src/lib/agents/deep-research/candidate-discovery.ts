import type { ResearchTask } from "./types";
import { resolveResearchScope } from "./scope-resolver";

export interface ExplorationPillar {
  id: string;
  title: string;
  objective: string;
  searchQueries: {
    discovery: string[];
    primaryVerification: string[];
    independentCorroboration: string[];
    counterEvidence: string[];
  };
}

/**
 * Dynamically derives exploration pillars and multi-intent queries based on the user's research task.
 * Completely domain-agnostic and query-agnostic: no hardcoded AI, GPU, or model lists.
 */
export function generateAdaptiveExplorationPillars(task: ResearchTask): ExplorationPillar[] {
  const pillars: ExplorationPillar[] = [];
  const timeContext = task.temporalScope.targetTimeframeDescription
    ? ` ${task.temporalScope.targetTimeframeDescription}`
    : task.temporalScope.endDate
      ? ` ${task.temporalScope.endDate.slice(0, 4)}`
      : "";

  // 1. Comparison Intent (Entity-Centric Exploration)
  if (task.intent === "comparison" && task.entities.length >= 2) {
    for (const [idx, entity] of task.entities.entries()) {
      const id = `pillar_entity_${idx + 1}`;
      const dimensions = task.comparisonDimensions.slice(0, 3).join(" and ");

      pillars.push({
        id,
        title: `${entity}: Evaluation & Tradeoffs`,
        objective: `Analyze ${entity} across ${dimensions}, identifying verified strengths, costs, and operational constraints.`,
        searchQueries: {
          discovery: [
            `${entity} overview features capabilities${timeContext}`,
            `${entity} architecture tradeoffs`,
          ],
          primaryVerification: [
            `${entity} official documentation pricing SLA`,
            `${entity} technical specifications`,
          ],
          independentCorroboration: [
            `${entity} vs ${task.entities.filter((e) => e !== entity).join(" ")} benchmark comparison`,
            `${entity} independent evaluation report`,
          ],
          counterEvidence: [
            `${entity} disadvantages limitations drawbacks`,
            `${entity} outages complaints failure modes`,
          ],
        },
      });
    }

    // Add cross-entity synthesis pillar
    pillars.push({
      id: "pillar_cross_comparison",
      title: "Direct Comparative Benchmarks & Tradeoffs",
      objective: `Direct head-to-head empirical comparison of ${task.entities.join(", ")} for ${task.question}`,
      searchQueries: {
        discovery: [`${task.entities.join(" vs ")} direct comparison${timeContext}`],
        primaryVerification: [`${task.entities.join(" ")} pricing comparison`],
        independentCorroboration: [`${task.entities.join(" ")} independent benchmark study`],
        counterEvidence: [`${task.entities.join(" ")} hidden costs migration hurdles`],
      },
    });

    return pillars;
  }

  // 2. Historical / Causal Investigation Intent
  if (task.intent === "historical_cause") {
    pillars.push({
      id: "pillar_root_causes",
      title: "Root Structural Vulnerabilities & Systemic Drivers",
      objective: `Investigate foundational causes, structural preconditions, and pre-existing fragilities underlying ${task.question}`,
      searchQueries: {
        discovery: [`causes of ${task.question} structural factors${timeContext}`],
        primaryVerification: [`${task.question} official commission inquiry report findings`],
        independentCorroboration: [`${task.question} economic historical academic consensus`],
        counterEvidence: [`critique of traditional explanations for ${task.question}`],
      },
    });

    pillars.push({
      id: "pillar_catalyst_triggers",
      title: "Immediate Catalysts & Propagation Mechanisms",
      objective: `Examine the trigger events, liquidity contagion, and domino mechanisms that precipitated ${task.question}`,
      searchQueries: {
        discovery: [`timeline triggers ${task.question}${timeContext}`],
        primaryVerification: [`chronology of key events ${task.question}`],
        independentCorroboration: [`propagation mechanism contagion ${task.question}`],
        counterEvidence: [`alternative theories triggers ${task.question}`],
      },
    });

    pillars.push({
      id: "pillar_counterfactuals",
      title: "Counter-Evidence & Competing Explanations",
      objective: `Critically audit competing schools of thought, policy critiques, and disputed causal attributions.`,
      searchQueries: {
        discovery: [`competing explanations ${task.question}`],
        primaryVerification: [`retrospective analysis ${task.question}`],
        independentCorroboration: [`academic debate causes ${task.question}`],
        counterEvidence: [`evidence disproving common myths about ${task.question}`],
      },
    });

    return pillars;
  }

  // 3. Scientific Verification Intent
  if (task.intent === "verification") {
    pillars.push({
      id: "pillar_primary_claims",
      title: "Primary Empirical Claims & Methodology",
      objective: `Extract the core scientific hypotheses, experimental data, and methodology supporting ${task.question}`,
      searchQueries: {
        discovery: [`${task.question} research paper study`],
        primaryVerification: [`${task.question} experimental methodology data`],
        independentCorroboration: [`peer review ${task.question}`],
        counterEvidence: [`failed replication ${task.question}`],
      },
    });

    pillars.push({
      id: "pillar_adversarial_replications",
      title: "Independent Replication & Counter-Evidence",
      objective: `Search explicitly for failed replications, methodological criticisms, and counter-studies.`,
      searchQueries: {
        discovery: [`replication attempts ${task.question}`],
        primaryVerification: [`critique limitations ${task.question}`],
        independentCorroboration: [`independent testing ${task.question}`],
        counterEvidence: [`evidence refuting ${task.question}`, `scientific controversy ${task.question}`],
      },
    });

    return pillars;
  }

  // 4. Ranking / Breakthroughs Intent (Generic Landscape Exploration)
  const dimensionsToExplore =
    task.comparisonDimensions.length >= 3
      ? task.comparisonDimensions
      : [
          "Technological Foundations & Breakthroughs",
          "Quantitative Performance & Empirical Metrics",
          "Production Adoption & Commercial Impact",
        ];

  for (const [idx, dim] of dimensionsToExplore.slice(0, 4).entries()) {
    const id = `pillar_dimension_${idx + 1}`;
    pillars.push({
      id,
      title: `${dim}: Advancements & Evidence`,
      objective: `Investigate major advancements in ${task.question} focusing on ${dim}.`,
      searchQueries: {
        discovery: [
          `${task.question} ${dim} developments${timeContext}`,
          `${task.question} breakthrough review`,
        ],
        primaryVerification: [
          `${task.question} technical reports official data`,
          `${task.question} peer-reviewed research papers`,
        ],
        independentCorroboration: [
          `${task.question} benchmark evaluation comparative study`,
        ],
        counterEvidence: [
          `limitations challenges bottlenecks ${task.question}`,
          `criticisms failures ${task.question}`,
        ],
      },
    });
  }

  return pillars;
}

// Backwards compatibility alias
export const generateLandscapeCandidates = (task: ResearchTask) => {
  const pillars = generateAdaptiveExplorationPillars(task);
  return pillars.map((p) => ({
    id: p.id,
    name: p.title,
    domain: task.intent,
    subdomain: p.objective,
    searchQueries: {
      academic: p.searchQueries.primaryVerification[0] || p.title,
      web: p.searchQueries.discovery[0] || p.title,
    },
  }));
};

/**
 * Generates multi-intent search plan across 4 pillars:
 * 1. discovery
 * 2. primaryVerification
 * 3. independentCorroboration
 * 4. counterEvidenceSearch
 */
export function generateMultiIntentSearchPlan(questionOrTask: string | ResearchTask): {
  pillars: {
    discovery: string[];
    primaryVerification: string[];
    independentCorroboration: string[];
    counterEvidenceSearch: string[];
  };
  explorationPillars: ExplorationPillar[];
} {
  const task =
    typeof questionOrTask === "string"
      ? resolveResearchScope(questionOrTask)
      : questionOrTask;

  const explorationPillars = generateAdaptiveExplorationPillars(task);

  const discovery: string[] = [];
  const primaryVerification: string[] = [];
  const independentCorroboration: string[] = [];
  const counterEvidenceSearch: string[] = [];

  for (const p of explorationPillars) {
    discovery.push(...p.searchQueries.discovery);
    primaryVerification.push(...p.searchQueries.primaryVerification);
    independentCorroboration.push(...p.searchQueries.independentCorroboration);
    counterEvidenceSearch.push(...p.searchQueries.counterEvidence);
  }

  return {
    pillars: {
      discovery: Array.from(new Set(discovery)),
      primaryVerification: Array.from(new Set(primaryVerification)),
      independentCorroboration: Array.from(new Set(independentCorroboration)),
      counterEvidenceSearch: Array.from(new Set(counterEvidenceSearch)),
    },
    explorationPillars,
  };
}

