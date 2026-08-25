/**
 * Epistemic Calibration & Language Audit
 * Remispace Deep Research Agent
 */

import type { ClaimEvidenceLedgerItem } from "./types";

export interface CalibrationResult {
  calibratedText: string;
  flaggedTerms: string[];
  replacementsCount: number;
  uncalibratedTablesFound: number;
  inventedContextsCleansed: number;
}

// Regex patterns for high-risk absolute and uncalibrated phrasing
const CALIBRATION_RULES: Array<{
  pattern: RegExp;
  replacement: string;
  description: string;
}> = [
  {
    pattern: /\bno (methods?|techniques?|solutions?|approaches?) exists?\b/gi,
    replacement: "the reviewed literature does not establish a standardized approach",
    description: "Replaced unverified absolute claim 'no method exists'",
  },
  {
    pattern: /\bno (benchmarks?|evaluations?|datasets?) exists?\b/gi,
    replacement: "standardized cross-domain benchmarks remain limited in the published literature",
    description: "Calibrated absolute assertion 'no benchmark exists'",
  },
  {
    pattern: /\bno evidence exists\b/gi,
    replacement: "we found limited empirical evidence in the reviewed literature",
    description: "Replaced 'no evidence exists' with 'limited empirical evidence'",
  },
  {
    pattern: /\bdefinitively (proves?|establishes?|solves?)\b/gi,
    replacement: "provides strong empirical support indicating",
    description: "Calibrated 'definitively proves'",
  },
  {
    pattern: /\buniversally (outperforms?|dominates?|scales?)\b/gi,
    replacement: "consistently outperforms evaluated baselines across tested configurations",
    description: "Calibrated 'universally outperforms'",
  },
  {
    pattern: /\bcompletely (solves?|eliminates?|prevents?)\b/gi,
    replacement: "substantially reduces",
    description: "Calibrated 'completely solves/eliminates'",
  },
  {
    pattern: /\bguarantees? that\b/gi,
    replacement: "is architected to provide",
    description: "Calibrated 'guarantees that'",
  },
  {
    pattern: /\bdoes not scale\b/gi,
    replacement: "exhibits notable computational scaling constraints under evaluated workloads",
    description: "Calibrated sweeping claim 'does not scale'",
  },
  {
    pattern: /\bimpossible to\b/gi,
    replacement: "presents substantial unresolved theoretical and empirical challenges to",
    description: "Calibrated 'impossible to'",
  },
];

// Anti-Invented Context cleansing rules
const INVENTED_CONTEXT_RULES: Array<{
  pattern: RegExp;
  replacement: string;
  description: string;
}> = [
  {
    pattern: /\bHardware:\s*(?:Not specified\s*)?\(assumed\s+[^)]+\)/gi,
    replacement: "Hardware: Not reported in the source",
    description: "Cleansed inferred hardware assumption to explicit 'Not reported in the source'",
  },
  {
    pattern: /\b(?:assumed|likely|probably)\s+(?:standard\s+gpu\s+clusters?|h100|a100|v100|3\s+seeds)\b/gi,
    replacement: "unspecified in primary publication",
    description: "Cleansed inferred hardware/seed assumption",
  },
  {
    pattern: /\btypical\s+configuration\s*\(assumed\)/gi,
    replacement: "experimental configuration not explicitly detailed in source",
    description: "Cleansed assumed typical configuration",
  },
];

/**
 * Deterministically audits and calibrates text, enforcing epistemic modesty and removing invented details.
 */
export function auditAndCalibrateText(
  text: string,
  _ledger?: ClaimEvidenceLedgerItem[],
): CalibrationResult {
  let calibratedText = text;
  const flaggedTerms: string[] = [];
  let replacementsCount = 0;
  let inventedContextsCleansed = 0;

  // 1. Enforce Epistemic Calibration
  for (const rule of CALIBRATION_RULES) {
    if (rule.pattern.test(calibratedText)) {
      flaggedTerms.push(rule.description);
      calibratedText = calibratedText.replace(rule.pattern, () => {
        replacementsCount++;
        return rule.replacement;
      });
    }
  }

  // 2. Cleanse Invented Experimental Context
  for (const rule of INVENTED_CONTEXT_RULES) {
    if (rule.pattern.test(calibratedText)) {
      inventedContextsCleansed++;
      flaggedTerms.push(rule.description);
      calibratedText = calibratedText.replace(rule.pattern, () => rule.replacement);
    }
  }

  // 3. Mathematical Formulation Labeling check
  // If equations appear in text, ensure they do not claim generic equations as algorithm-specific formulations
  if (/\$\$[\s\S]*?\$\$/g.test(calibratedText)) {
    calibratedText = calibratedText.replace(
      /(The (?:algorithm|method|model) (?:uses|is defined by) the following (?:exact )?formulation:\s*\n+\$\$)/gi,
      "Theoretical formulation synthesized from reviewed literature:\n$$",
    );
  }

  // 4. Audit markdown tables for undefined "High / Medium / Low" qualitative ratings
  let uncalibratedTablesFound = 0;
  if (/\|\s*(High|Medium|Low|Very High)\s*\|/i.test(calibratedText)) {
    if (!calibratedText.includes("Qualitative assessment based on reviewed literature")) {
      uncalibratedTablesFound++;
      calibratedText = calibratedText.replace(
        /(\|[\s\S]*?\|\n\n)/g,
        (tableMatch) => {
          if (/\|\s*(High|Medium|Low)\s*\|/i.test(tableMatch) && !tableMatch.includes("Qualitative assessment")) {
            return `${tableMatch}*Note: Qualitative ratings in the comparison matrix reflect comparative assessments synthesized across reviewed literature, not direct single-benchmark empirical measurements.*\n\n`;
          }
          return tableMatch;
        },
      );
    }
  }

  return {
    calibratedText,
    flaggedTerms,
    replacementsCount,
    uncalibratedTablesFound,
    inventedContextsCleansed,
  };
}
