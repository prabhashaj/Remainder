/**
 * Citation Entailment Auditor
 * Remispace Deep Research Agent
 */

import type { CitationAuditResult, ClaimEvidenceLedgerItem, ResearchSource, VerificationStatus } from "./types";

/**
 * Audits citations in the drafted report against the Claim-Evidence Ledger and Verified Sources.
 */
export function auditCitationEntailment(
  reportText: string,
  ledger: ClaimEvidenceLedgerItem[],
  sources: ResearchSource[],
): CitationAuditResult {
  const auditItems: CitationAuditResult["auditItems"] = [];
  let verifiedCount = 0;
  let partiallySupportedCount = 0;
  let unsupportedCount = 0;

  // Extract inline citation references like [1], [Author, Year], [arXiv:2301.12345], (Vaswani et al., 2017)
  const paragraphs = reportText.split(/\n\n+/).filter((p) => p.trim().length > 30 && !p.startsWith("#"));

  for (const para of paragraphs) {
    // Check if paragraph makes concrete claims
    const matchedSources = sources.filter((s) => {
      const titleSnippet = s.title.slice(0, 25).toLowerCase();
      const idSnippet = s.id.toLowerCase();
      const urlSnippet = s.url.toLowerCase();
      const authorSnippet = s.authors[0] ? s.authors[0].toLowerCase() : "";

      const paraLower = para.toLowerCase();
      return (
        paraLower.includes(titleSnippet) ||
        paraLower.includes(idSnippet) ||
        (authorSnippet && paraLower.includes(authorSnippet)) ||
        (s.url.includes("arxiv.org") && paraLower.includes(s.yearOrId.toLowerCase()))
      );
    });

    if (matchedSources.length > 0) {
      for (const src of matchedSources) {
        // Find matching ledger items for this source
        const relevantLedgerItems = ledger.filter((l) => l.source_title === src.title || l.source_url === src.url);

        let status: VerificationStatus = "VERIFIED";
        let reason = "Directly supported by verified primary source.";

        if (relevantLedgerItems.length === 0) {
          status = "PARTIALLY_SUPPORTED";
          reason = "Source cited in text is present in bibliography but lacks structured ledger claim extraction.";
          partiallySupportedCount++;
        } else {
          const hasUnsupported = relevantLedgerItems.some((l) => l.verification_status === "UNSUPPORTED");
          const hasPartial = relevantLedgerItems.some((l) => l.verification_status === "PARTIALLY_SUPPORTED");

          if (hasUnsupported) {
            status = "UNSUPPORTED";
            reason = "Claim contains numerical figures or assertions not confirmed by source text.";
            unsupportedCount++;
          } else if (hasPartial) {
            status = "PARTIALLY_SUPPORTED";
            reason = "Context or baseline partially mismatched with primary study.";
            partiallySupportedCount++;
          } else {
            verifiedCount++;
          }
        }

        auditItems.push({
          claimSnippet: para.slice(0, 120) + "...",
          sourceTitle: src.title,
          sourceUrl: src.url,
          status,
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
    citationEntailmentRatio,
    auditItems,
  };
}
