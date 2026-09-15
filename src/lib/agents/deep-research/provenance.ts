import type {
  EvidenceLedgerEntry,
  ProvenanceStep,
  ResearchProvenanceTrace,
  ResearchScope,
} from "./types";

export class ProvenanceTracker {
  private trace: ResearchProvenanceTrace;

  constructor(question: string, scope: ResearchScope) {
    this.trace = {
      question,
      task: scope as any,
      scope: scope as any,
      provenanceTrail: [],
    };
  }

  addStep(step: ProvenanceStep) {
    this.trace.provenanceTrail.push(step);
  }

  recordEvidenceTrace(entry: EvidenceLedgerEntry, impactScore?: number) {
    const primaryTitle = entry.primarySource?.title || "Unknown Source";
    const primaryUrl = entry.primarySource?.url || "";

    this.addStep({
      step: `Claim Verification: ${entry.id}`,
      sourcesFound: entry.sources.length,
      sourcesSelected: entry.sources.map((s) => `${s.publisher} (${s.sourceType}, Tier ${s.sourceTier})`),
      claimsExtracted: 1,
      verificationOutcome: entry.verificationNotes || "Verified",
      confidence: entry.confidenceLevel,
      impactScore,
      finalSentenceSummary: entry.claim,
      citationsAssigned: [`[${primaryTitle}](${primaryUrl})`],
    });
  }

  getTrace(): ResearchProvenanceTrace {
    return this.trace;
  }

  getSummary(): string {
    return this.trace.provenanceTrail
      .map(
        (p, idx) =>
          `Step ${idx + 1}: ${p.step} | Confidence: ${p.confidence || "N/A"} | Impact: ${p.impactScore ?? "N/A"} | Citations: ${(p.citationsAssigned || []).join(", ")}`,
      )
      .join("\n");
  }
}
