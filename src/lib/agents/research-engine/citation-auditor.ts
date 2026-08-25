/**
 * Citation Entailment & Source Attribution Auditor
 * Remispace Deep Research Agent
 */

import type {
  CanonicalSource,
  CitationAuditResult,
  ClaimEvidenceLedgerItem,
  SupportLevel,
  VerificationStatus,
} from "./types";

/**
 * Audits citations in the drafted report against the Claim-Evidence Ledger and Canonical Sources.
 */
export function auditCitationEntailment(
  reportText: string,
  ledger: ClaimEvidenceLedgerItem[],
  sources: CanonicalSource[],
): CitationAuditResult {
  const auditItems: CitationAuditResult["auditItems"] = [];
  let verifiedCount = 0;
  let partiallySupportedCount = 0;
  let unsupportedCount = 0;
  let wrongPaperAttributionCount = 0;

  const paragraphs = reportText.split(/\n\n+/).filter((p) => p.trim().length > 30 && !p.startsWith("#"));

  for (const para of paragraphs) {
    const matchedSources = sources.filter((s) => {
      const titleSnippet = s.canonical_title.slice(0, 25).toLowerCase();
      const idSnippet = s.source_id.toLowerCase();
      const urlSnippet = s.canonical_url.toLowerCase();
      const authorSnippet = s.authors[0] ? s.authors[0].toLowerCase() : "";

      const paraLower = para.toLowerCase();
      return (
        paraLower.includes(titleSnippet) ||
        paraLower.includes(idSnippet) ||
        (authorSnippet && paraLower.includes(authorSnippet)) ||
        (s.arxiv_id && paraLower.includes(s.arxiv_id.toLowerCase()))
      );
    });

    if (matchedSources.length > 0) {
      for (const src of matchedSources) {
        const relevantLedgerItems = ledger.filter(
          (l) => l.source_title === src.canonical_title || l.source_url === src.canonical_url || l.source_ids.includes(src.source_id),
        );

        let status: VerificationStatus = "VERIFIED";
        let supportLevel: SupportLevel = "DIRECTLY_SUPPORTED";
        let reason = "Directly supported by verified primary source.";

        // Check for Wrong Paper Attribution (e.g. Paper evaluating or citing method X attributed as proposing method X)
        const isWrongPaper = relevantLedgerItems.some(
          (l) => l.paper_contribution_vs_related === "related_concept" && l.claim.toLowerCase().includes("propose") || l.claim.toLowerCase().includes("introduces"),
        );

        if (isWrongPaper) {
          status = "UNSUPPORTED";
          supportLevel = "UNSUPPORTED";
          reason = `Wrong paper attribution: Source "${src.canonical_title}" is a related work that evaluates/cites the concept, not the primary origin of the method.`;
          wrongPaperAttributionCount++;
          unsupportedCount++;
        } else if (relevantLedgerItems.length === 0) {
          status = "PARTIALLY_SUPPORTED";
          supportLevel = "PARTIALLY_SUPPORTED";
          reason = "Source cited in text exists in registry but lacks structured primary claim extraction.";
          partiallySupportedCount++;
        } else {
          const hasUnsupported = relevantLedgerItems.some((l) => l.verification_status === "UNSUPPORTED");
          const hasPartial = relevantLedgerItems.some((l) => l.verification_status === "PARTIALLY_SUPPORTED");

          if (hasUnsupported) {
            status = "UNSUPPORTED";
            supportLevel = "UNSUPPORTED";
            reason = "Claim contains figures or assertions not confirmed by source text.";
            unsupportedCount++;
          } else if (hasPartial) {
            status = "PARTIALLY_SUPPORTED";
            supportLevel = "PARTIALLY_SUPPORTED";
            reason = "Context or baseline partially mismatched with primary study.";
            partiallySupportedCount++;
          } else {
            verifiedCount++;
          }
        }

        auditItems.push({
          claimSnippet: para.slice(0, 140) + "...",
          sourceId: src.source_id,
          sourceTitle: src.canonical_title,
          sourceUrl: src.canonical_url,
          status,
          supportLevel,
          reason,
        });
      }
    }
  }

  const totalAudited = verifiedCount + partiallySupportedCount + unsupportedCount;
  const citationEntailmentRatio = totalAudited > 0 ? (verifiedCount + partiallySupportedCount * 0.7) / totalAudited : 1.0;

  return {
    totalCitationsAudited: totalAudited,
    verifiedCount,
    partiallySupportedCount,
    unsupportedCount,
    wrongPaperAttributionCount,
    citationEntailmentRatio,
    auditItems,
  };
}
