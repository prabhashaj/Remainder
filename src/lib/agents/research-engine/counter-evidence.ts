/**
 * Contradiction Search & Research Gap Verification
 * Remispace Deep Research Agent
 */

import { tavilySearch, type WebResult } from "@/lib/tavily.server";
import { searchArxivServer, searchPapersServer } from "@/lib/academic-tools.server";
import { log } from "@/lib/logger.server";
import type { ClaimEvidenceLedgerItem } from "./types";

export interface CounterEvidenceQuery {
  claimId: string;
  claim: string;
  targetType: "contradiction" | "research_gap_check" | "limitation";
  query: string;
}

/**
 * Generates targeted counter-evidence queries for core claims and asserted research gaps.
 */
export function generateCounterEvidenceQueries(
  topic: string,
  claims: ClaimEvidenceLedgerItem[],
): CounterEvidenceQuery[] {
  const queries: CounterEvidenceQuery[] = [];

  for (const item of claims) {
    if (item.importance !== "core" && item.claim_type !== "research_gap" && item.claim_type !== "comparative") {
      continue;
    }

    if (item.claim_type === "research_gap" || /no (method|benchmark|dataset|approach|work) exists/i.test(item.claim)) {
      // Research gap verification query
      queries.push({
        claimId: item.claim_id,
        claim: item.claim,
        targetType: "research_gap_check",
        query: `${topic} benchmark dataset survey evaluation workshop`,
      });
    } else if (item.claim_type === "numerical" || item.claim_type === "comparative" || item.importance === "core") {
      // Contradiction / limitation query
      const cleanSubject = item.claim.slice(0, 60).replace(/[^\w\s]/g, " ");
      queries.push({
        claimId: item.claim_id,
        claim: item.claim,
        targetType: "contradiction",
        query: `${cleanSubject} limitations failure modes reproduction replication benchmark`,
      });
    }
  }

  // General topic-level failure mode query
  queries.push({
    claimId: "topic_general_counter",
    claim: topic,
    targetType: "limitation",
    query: `${topic} failure modes limitations drawbacks challenges bottlenecks`,
  });

  return queries.slice(0, 4); // Keep bounded for fast, cost-effective execution
}

/**
 * Executes counter-evidence search and attaches findings/caveats to ledger claims.
 */
export async function executeCounterEvidenceSearch(
  topic: string,
  ledgerItems: ClaimEvidenceLedgerItem[],
): Promise<{
  updatedLedger: ClaimEvidenceLedgerItem[];
  contradictionsFound: Array<{ claim: string; counterEvidence: string; source: string }>;
  verifiedGaps: string[];
}> {
  const queries = generateCounterEvidenceQueries(topic, ledgerItems);
  const contradictionsFound: Array<{ claim: string; counterEvidence: string; source: string }> = [];
  const verifiedGaps: string[] = [];

  const updatedLedger = [...ledgerItems];

  await Promise.all(
    queries.map(async (q) => {
      try {
        const [webRes, arxivRes] = await Promise.all([
          tavilySearch(q.query, { maxResults: 3, depth: "basic" }).catch(() => ({ results: [] as WebResult[] })),
          searchArxivServer(q.query, { maxResults: 2 }).catch(() => []),
        ]);

        const counterSnippets: string[] = [];

        for (const wr of webRes.results || []) {
          if (wr.content && (wr.content.toLowerCase().includes("limit") || wr.content.toLowerCase().includes("fail") || wr.content.toLowerCase().includes("however") || wr.content.toLowerCase().includes("drawback") || wr.content.toLowerCase().includes("benchmark"))) {
            counterSnippets.push(`[${wr.title}](${wr.url}): ${wr.content.slice(0, 250)}`);
          }
        }

        for (const ap of arxivRes) {
          counterSnippets.push(`[arXiv:${ap.id} ${ap.title}](${ap.arxivUrl}): ${ap.summary.slice(0, 250)}`);
        }

        if (counterSnippets.length > 0) {
          const combinedCounter = counterSnippets.slice(0, 2).join("\n");

          // If querying for a specific claim
          const targetItem = updatedLedger.find((item) => item.claim_id === q.claimId);
          if (targetItem) {
            targetItem.counter_evidence = combinedCounter;

            if (q.targetType === "research_gap_check") {
              // If we found benchmarks or datasets, calibrate the research gap
              if (/benchmark|dataset|evaluation/i.test(combinedCounter)) {
                targetItem.verification_status = "PARTIALLY_SUPPORTED";
                targetItem.confidence = "MEDIUM";
                targetItem.claim = targetItem.claim.replace(/no (benchmark|dataset|approach) exists/gi, "existing benchmarks have limited cross-architecture coverage");
                contradictionsFound.push({
                  claim: q.claim,
                  counterEvidence: "Found existing evaluation benchmarks in the literature.",
                  source: combinedCounter,
                });
              } else {
                verifiedGaps.push(targetItem.claim);
              }
            } else if (q.targetType === "contradiction") {
              contradictionsFound.push({
                claim: q.claim,
                counterEvidence: combinedCounter,
                source: combinedCounter,
              });
            }
          }
        }
      } catch (err) {
        log("warn", "counter_evidence_query_failed", { query: q.query, error: String(err) });
      }
    }),
  );

  return {
    updatedLedger,
    contradictionsFound,
    verifiedGaps,
  };
}
