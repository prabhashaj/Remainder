import { describe, it, expect } from "bun:test";
import {
  resolveResearchScope,
  evaluateSource,
  validateSourceTemporalWindow,
  reconcileReleaseVsAdoption,
  splitIntoAtomicClaims,
  extractNumericalData,
  validateCausalStatement,
  isClaimSupportedBySource,
  detectContradictionBetweenSources,
  compareSourceQuality,
  createLedgerEntry,
  rankCandidates,
  runResearchAudit,
  synthesizeResearchReport,
  type SourceMetadata,
  type AtomicClaim,
  type EvidenceLedger,
  type CandidateEvaluationInput,
} from "@/lib/agents/deep-research";

describe("Evidence-Grounded Deep Research Agent Test Suite", () => {
  // TEST 1 — FUTURE SOURCE (Hard Temporal Cutoff)
  it("TEST 1: rejects sources published after research cutoff date", () => {
    const scope = resolveResearchScope(
      "What were the biggest AI upgrades between January 1, 2025 and September 15, 2026?",
    );

    expect(scope.startDate).toBe("2025-01-01");
    expect(scope.endDate).toBe("2026-09-15");

    // Source dated October 2026 (strictly after cutoff)
    const futureSource = evaluateSource({
      url: "https://openai.com/index/future-model-announcement/",
      title: "OpenAI Announces Next Generation Reasoning System",
      publishedDateHint: "October 10, 2026",
    });

    const validation = validateSourceTemporalWindow(futureSource, scope);
    expect(validation.status).toBe("rejected_out_of_window");
    expect(validation.reason).toContain("strictly after the research cutoff date 2026-09-15");

    // In-window source dated March 2026
    const inWindowSource = evaluateSource({
      url: "https://arxiv.org/abs/2603.12345",
      title: "Efficient Reasoning in Large Models",
      publishedDateHint: "March 15, 2026",
    });

    const inWindowValidation = validateSourceTemporalWindow(inWindowSource, scope);
    expect(inWindowValidation.status).toBe("valid");
  });

  // TEST 2 — UNSUPPORTED CLAIM (Compound Sentence Splitting & Claim Verification)
  it("TEST 2: accepts only verified claims from compound sentence and flags unsupported parts", () => {
    // Source only confirms Model X was released
    const source = evaluateSource({
      url: "https://anthropic.com/news/claude-3-5-sonnet",
      title: "Claude 3.5 Sonnet Released",
      rawSnippet: "Anthropic has released Claude 3.5 Sonnet across all platforms today.",
    });

    // Agent attempts to make compound claim
    const compoundText = "Claude 3.5 Sonnet was released, and is 40% cheaper and 2x faster.";
    const atomicClaims = splitIntoAtomicClaims(compoundText);

    expect(atomicClaims.length).toBeGreaterThanOrEqual(2);

    // Verify each atomic claim against the source
    const releaseClaim = atomicClaims.find((c) => c.claim.toLowerCase().includes("released"));
    const cheaperClaim = atomicClaims.find((c) => c.claim.toLowerCase().includes("cheaper"));
    const fasterClaim = atomicClaims.find((c) => c.claim.toLowerCase().includes("faster"));

    expect(releaseClaim).toBeDefined();
    expect(cheaperClaim).toBeDefined();
    expect(fasterClaim).toBeDefined();

    const checkRelease = isClaimSupportedBySource(releaseClaim!, source);
    expect(checkRelease.supported).toBe(true);

    const checkCheaper = isClaimSupportedBySource(cheaperClaim!, source);
    expect(checkCheaper.supported).toBe(false);

    const checkFaster = isClaimSupportedBySource(fasterClaim!, source);
    expect(checkFaster.supported).toBe(false);
  });

  // TEST 3 — SECONDARY SOURCE (Source Hierarchy & Preference)
  it("TEST 3: strictly prefers Tier 1 primary official announcement over Tier 3 secondary blog", () => {
    const primarySource = evaluateSource({
      url: "https://openai.com/index/learning-to-reason-with-llms/",
      title: "Introducing OpenAI o1",
      rawSnippet: "OpenAI o1 spends more time thinking before answering.",
    });

    const secondarySource = evaluateSource({
      url: "https://medium.com/some-tech-blog/openai-o1-overview",
      title: "Why OpenAI o1 Matters",
      rawSnippet: "A look into OpenAI's new model o1.",
    });

    expect(primarySource.sourceTier).toBe(1);
    expect(primarySource.primarySource).toBe(true);
    expect(primarySource.sourceType).toBe("official_company");

    expect(secondarySource.sourceTier).toBe(3);
    expect(secondarySource.primarySource).toBe(false);
    expect(secondarySource.sourceType).toBe("blog");

    // Primary source must compare higher (negative return value in sort)
    const preference = compareSourceQuality(primarySource, secondarySource);
    expect(preference).toBeLessThan(0);
  });

  // TEST 4 — CONFLICTING SOURCES (Contradiction Detection)
  it("TEST 4: flags contradiction when sources report conflicting parameter counts", () => {
    const sourceA = evaluateSource({
      url: "https://deepseek.com/news/deepseek-v3",
      title: "DeepSeek-V3 Technical Overview",
      rawSnippet: "DeepSeek-V3 adopts an innovative architecture with 671B parameters.",
    });

    const sourceB = evaluateSource({
      url: "https://tech-blog-rumors.com/deepseek-leak",
      title: "DeepSeek Leak Report",
      rawSnippet: "DeepSeek reportedly trained a 500B parameters model.",
    });

    const statementA = "DeepSeek-V3 has 671B parameters.";
    const statementB = "DeepSeek-V3 has 500B parameters.";

    const contradiction = detectContradictionBetweenSources(
      statementA,
      sourceA,
      statementB,
      sourceB,
      "DeepSeek-V3 Parameters",
    );

    expect(contradiction).not.toBeNull();
    expect(contradiction?.discrepancyType).toBe("numerical");
    expect(contradiction?.resolution).toContain("preferred over");
    expect(contradiction?.resolution).toContain("deepseek.com");
  });

  // TEST 5 — CAUSAL CLAIM (Downgrading Unsupported Causation to Correlation)
  it("TEST 5: prevents unsupported causal assertions and enforces correlational framing", () => {
    const unsupportedCausalSentence = "Blackwell GPUs caused the surge in reasoning agent adoption.";

    // Validated without direct causal proof
    const causalCheck = validateCausalStatement(unsupportedCausalSentence, false);

    expect(causalCheck.isCausalClaim).toBe(true);
    expect(causalCheck.supportedByDirectEvidence).toBe(false);
    expect(causalCheck.causalVerbsFound).toContain("caused");
    expect(causalCheck.suggestedWording).toContain("likely contributed to");
    expect(causalCheck.suggestedWording).not.toContain(" caused ");
  });

  // TEST 6 — NUMERICAL CLAIM (Baseline and Measurement Condition Verification)
  it("TEST 6: parses numerical claim, extracts percentage, and detects missing baselines", () => {
    // Uncontextualized claim
    const uncontextualized = "The model is 30% faster.";
    const metricUncontextualized = extractNumericalData(uncontextualized);

    expect(metricUncontextualized).toBeDefined();
    expect(metricUncontextualized?.value).toBe("30%");
    expect(metricUncontextualized?.unit).toBe("%");
    expect(metricUncontextualized?.baseline).toBeUndefined(); // Baseline is missing!

    // Properly contextualized claim
    const contextualized = "The model is 30% faster than Llama 3 on HumanEval under FP8.";
    const metricContextualized = extractNumericalData(contextualized);

    expect(metricContextualized).toBeDefined();
    expect(metricContextualized?.baseline).toContain("Llama 3");
    expect(metricContextualized?.measurementConditions).toContain("HumanEval");
  });

  // TEST 7 — EXPLICIT IMPACT RANKING (Weighted Multi-Dimension Scoring)
  it("TEST 7: scores and ranks candidates using explicit 7-dimension weighted criteria", () => {
    const candidateA: CandidateEvaluationInput = {
      name: "Test-Time Reasoning Models",
      domain: "Model Architectures",
      whatChanged: "Shift to inference-time compute scaling.",
      whyItMatters: "Enables breakthrough mathematical and coding performance.",
      technicalSignificance: "Decouples reasoning performance from pre-training size.",
      realWorldImpact: "High enterprise and developer adoption.",
      dates: { releaseDate: "2024-09", adoptionDate: "2025" },
      dimensions: {
        technicalNovelty: 9.5, // 20% = 1.90
        capabilityImprovement: 9.5, // 20% = 1.90
        realWorldAdoption: 9.0, // 20% = 1.80
        economicIndustryImpact: 8.5, // 15% = 1.275
        researchSignificance: 9.5, // 10% = 0.95
        breadthOfImpact: 8.5, // 10% = 0.85
        evidenceQuality: 9.0, // 5% = 0.45  Total = 9.125 -> 9.13
      },
      confidenceLevel: "green",
      primaryEvidenceQuote: "Test-time compute produces power-law performance scaling.",
      supportingLedgerEntryIds: ["claim_1"],
      limitations: "High token consumption and latency.",
    };

    const candidateB: CandidateEvaluationInput = {
      name: "Niche Voice Cloning Widget",
      domain: "Audio",
      whatChanged: "Minor voice fine-tuning tool.",
      whyItMatters: "Allows custom voice tones.",
      technicalSignificance: "Incremental architecture adjustment.",
      realWorldImpact: "Limited consumer adoption.",
      dates: { releaseDate: "2025-02" },
      dimensions: {
        technicalNovelty: 4.0,
        capabilityImprovement: 4.0,
        realWorldAdoption: 3.0,
        economicIndustryImpact: 2.5,
        researchSignificance: 3.0,
        breadthOfImpact: 3.0,
        evidenceQuality: 7.0,
      },
      confidenceLevel: "yellow",
      primaryEvidenceQuote: "Generates custom audio clips with standard vocoder.",
      supportingLedgerEntryIds: ["claim_2"],
      limitations: "Limited to short clips.",
    };

    const ranked = rankCandidates([candidateB, candidateA], 1);

    expect(ranked[0]?.candidateName).toBe("Test-Time Reasoning Models");
    expect(ranked[0]?.rank).toBe(1);
    expect(ranked[0]?.includedInTopRanking).toBe(true);
    expect(ranked[0]?.impactScore.totalScore).toBeGreaterThan(8.5);

    expect(ranked[1]?.candidateName).toBe("Niche Voice Cloning Widget");
    expect(ranked[1]?.rank).toBe(2);
    expect(ranked[1]?.includedInTopRanking).toBe(false);
    expect(ranked[1]?.exclusionReason).toBeDefined();
  });

  // TEST 8 — DATE CONFUSION (Release vs Adoption Differentiation)
  it("TEST 8: distinguishes 2024 release from 2026 adoption and formats proper temporal reconciliation", () => {
    const reconciliation = reconcileReleaseVsAdoption({
      entityName: "NVIDIA Blackwell B200",
      releaseYear: 2024,
      adoptionYear: 2026,
      windowStartYear: 2025,
      windowEndYear: 2026,
    });

    expect(reconciliation.needsAdoptionClarification).toBe(true);
    expect(reconciliation.clarifiedStatement).toContain(
      "NVIDIA Blackwell B200 was originally released in 2024, but its production adoption and industry impact accelerated during the research window (2026).",
    );
  });

  // TEST 9 — ENTITY CONFUSION (Canonical Entity Normalization & Version Integrity)
  it("TEST 9: maintains strict separation between distinct model generations and versions", () => {
    const scope = resolveResearchScope("AI updates in 2025");
    const source = evaluateSource({
      url: "https://openai.com/index/hello-gpt-4o/",
      title: "Hello GPT-4o",
      rawSnippet: "OpenAI announces GPT-4o, an omni model natively processing text, audio, and vision.",
    });

    // Create claims for GPT-4 and GPT-4o
    const claimGpt4: AtomicClaim = {
      id: "c1",
      claim: "GPT-4 was introduced in 2023.",
      claimType: "fact",
      canonicalEntity: "GPT-4",
      dates: { releaseDate: "2023-03-14" },
    };

    const claimGpt4o: AtomicClaim = {
      id: "c2",
      claim: "GPT-4o provides native omni-modal audio and visual capabilities.",
      claimType: "fact",
      canonicalEntity: "GPT-4o",
      dates: { releaseDate: "2024-05-13" },
    };

    expect(claimGpt4.canonicalEntity).not.toBe(claimGpt4o.canonicalEntity);

    const ledgerGpt4o = createLedgerEntry({
      claim: claimGpt4o,
      supportingSources: [source],
      contradictions: [],
      temporalStatus: "valid",
    });

    expect(ledgerGpt4o.confidenceLevel).toBe("green");
    expect(ledgerGpt4o.canonicalEntity).toBe("GPT-4o");
  });

  // TEST 10 — EMPTY EVIDENCE (Unverified Claim Failure Handling)
  it("TEST 10: explicitly marks claims with zero reliable sources as unverified without hallucination", () => {
    const unverifiedClaim: AtomicClaim = {
      id: "unverified_1",
      claim: "Quantum-AI processor achieved room-temperature superconductivity in 2025.",
      claimType: "fact",
      dates: {},
    };

    // No supporting sources found
    const ledgerEntry = createLedgerEntry({
      claim: unverifiedClaim,
      supportingSources: [],
      contradictions: [],
      temporalStatus: "unspecified",
    });

    expect(ledgerEntry.confidenceLevel).toBe("red");
    expect(ledgerEntry.confidenceScore).toBeLessThanOrEqual(0.2);
    expect(ledgerEntry.verificationNotes).toContain("I could not verify this claim");
  });

  // TEST 11 — END-TO-END AUDIT & SYNTHESIS INTEGRITY
  it("TEST 11: executes 11-dimension research audit and verifies bibliography grounding", () => {
    const scope = resolveResearchScope(
      "What were the biggest AI upgrades between January 1, 2025 and September 15, 2026?",
    );

    const verifiedSource = evaluateSource({
      url: "https://arxiv.org/abs/2501.12345",
      title: "Reasoning Scaling Laws in Test-Time Compute",
      publishedDateHint: "2025-01-15",
      rawSnippet: "We demonstrate test-time compute scaling laws on mathematical reasoning tasks.",
    });

    const claim: AtomicClaim = {
      id: "cand_1",
      claim: "Test-time compute scaling laws demonstrate predictable capability increases on mathematics.",
      claimType: "fact",
      dates: { releaseDate: "2025-01" },
    };

    const entry = createLedgerEntry({
      claim,
      supportingSources: [verifiedSource],
      contradictions: [],
      temporalStatus: "valid",
    });

    const ledger: EvidenceLedger = {
      entries: [entry],
      unverifiedClaims: [],
      rejectedSources: [],
      contradictions: [],
    };

    const candidate: CandidateEvaluationInput = {
      name: "Test-Time Compute Scaling",
      domain: "Model Architectures",
      whatChanged: "Shift from pre-training to test-time search.",
      whyItMatters: "Breaks traditional scaling barriers.",
      technicalSignificance: "Decouples performance from parameter count.",
      realWorldImpact: "High enterprise integration.",
      dates: { releaseDate: "2025-01" },
      dimensions: {
        technicalNovelty: 9.0,
        capabilityImprovement: 9.0,
        realWorldAdoption: 8.5,
        economicIndustryImpact: 8.5,
        researchSignificance: 9.0,
        breadthOfImpact: 8.0,
        evidenceQuality: 9.0,
      },
      confidenceLevel: "green",
      primaryEvidenceQuote: entry.claim,
      supportingLedgerEntryIds: [entry.id],
      limitations: "Higher per-token latency.",
    };

    const ranked = rankCandidates([candidate], 1);

    const { reportText, bibliography } = synthesizeResearchReport({
      scope,
      ledger,
      rankedCandidates: ranked,
    });

    expect(reportText).toContain("Comprehensive Deep Research Report");
    expect(reportText).toContain("Research Methodology");
    expect(reportText).toContain("Ranked Developments");
    expect(bibliography.length).toBe(1);
    expect(bibliography[0]?.url).toBe(verifiedSource.url);

    // Run 11-step audit
    const auditReport = runResearchAudit({
      scope,
      ledger,
      rankedCandidates: ranked,
      reportText,
      bibliographySources: bibliography,
    });

    expect(auditReport.overallPassed).toBe(true);
    expect(auditReport.temporalAudit.passed).toBe(true);
    expect(auditReport.sourceAudit.passed).toBe(true);
    expect(auditReport.claimAudit.passed).toBe(true);
    expect(auditReport.citationAudit.passed).toBe(true);
    expect(auditReport.bibliographyAudit.passed).toBe(true);
  });
});
