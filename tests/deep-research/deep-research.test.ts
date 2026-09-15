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
  deriveIndependenceGroup,
  calculateImportanceScore,
  generateMultiIntentSearchPlan,
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

  // TEST A: PRINCIPLE 1 — UNKNOWN DATES ARE STRICTLY NULL
  it("TEST A: preserves unknown publication dates as strictly null without inventing fake defaults", () => {
    const undatedSource = evaluateSource({
      url: "https://water-research.org/novel-polymeric-filtration",
      title: "Novel Polymeric Filtration for Industrial Effluent",
      rawSnippet: "A new polyamide composite membrane reduces heavy metal contaminants efficiently.",
    });

    expect(undatedSource.publicationDate).toBeNull();
    expect(undatedSource.dateStatus).toBe("unknown");
    expect(undatedSource.publicationDate).not.toBe("2021-01-01");
    expect(undatedSource.publicationDate).not.toBe("2024-01-01");
  });

  // TEST B: PRINCIPLE 2 — GROUNDING & SUPPORT DIRECTNESS
  it("TEST B: distinguishes DIRECT_SUPPORT from CONTEXTUAL_SUPPORT when numerical assertion is missing", () => {
    const source = evaluateSource({
      url: "https://energy.gov/reports/battery-technologies-2025",
      title: "DOE Report on Solid-State Battery Chemistry",
      rawSnippet: "The laboratory evaluated solid-state lithium metal pouch cells for electric vehicle propulsion systems.",
    });

    // Claim with specific quantitative density NOT in the snippet
    const unsupportedMetricClaim: AtomicClaim = {
      id: "claim_b1",
      claim: "The solid-state battery achieved 450 Wh/kg in production vehicles.",
      claimType: "fact",
      quantitative: { value: "450 Wh/kg", unit: "Wh/kg", category: "dimension" },
      dates: {},
    };

    const check = isClaimSupportedBySource(unsupportedMetricClaim, source);
    expect(check.supported).toBe(false);
    expect(check.directness).toBe("CONTEXTUAL_SUPPORT");
    expect(check.matchedExcerpt).toBeDefined();

    // Claim whose exact tokens and concepts are in the snippet
    const supportedClaim: AtomicClaim = {
      id: "claim_b2",
      claim: "The laboratory evaluated solid-state lithium metal pouch cells.",
      claimType: "fact",
      dates: {},
    };

    const checkDirect = isClaimSupportedBySource(supportedClaim, source);
    expect(checkDirect.supported).toBe(true);
    expect(checkDirect.directness).toBe("DIRECT_SUPPORT");
  });

  // TEST C: PRINCIPLE 3 — SOURCE INDEPENDENCE GROUPING
  it("TEST C: clusters syndicated PR wire reposts into the same independence group to prevent false corroboration", () => {
    const wire1 = deriveIndependenceGroup("prnewswire.com", "Startup Announces Battery Breakthrough");
    const wire2 = deriveIndependenceGroup("businesswire.com", "Startup Announces Battery Breakthrough");
    const wire3 = deriveIndependenceGroup("globenewswire.com", "Startup Announces Battery Breakthrough");

    expect(wire1).toBe("syndicated_wire");
    expect(wire2).toBe("syndicated_wire");
    expect(wire3).toBe("syndicated_wire");

    // Corporate subdomain clustering
    const awsDocs = deriveIndependenceGroup("docs.aws.amazon.com", "AWS Lambda Pricing");
    const awsBlog = deriveIndependenceGroup("aws.amazon.com", "Serverless Innovations");
    expect(awsDocs).toBe("amazon.com");
    expect(awsBlog).toBe("amazon.com");
  });

  // TEST D: PRINCIPLE 4 — IMPORTANCE SCORE SEPARATED FROM CONFIDENCE SCORE
  it("TEST D: calculates claim importance score independently from confidence score", () => {
    const highImportanceClaim: AtomicClaim = {
      id: "imp_1",
      claim: "Subprime mortgage securitization collapsed interbank liquidity by $700 billion.",
      claimType: "fact",
      quantitative: {
        value: "$700 billion",
        numericValue: 7e11,
        unit: "currency",
        category: "currency",
        baseline: "pre-crisis interbank lending",
      },
      causal: {
        isCausalClaim: true,
        classification: "CAUSATION",
        causalVerbsFound: ["collapsed"],
        supportedByDirectEvidence: true,
      },
      dates: {},
    };

    const trivialClaim: AtomicClaim = {
      id: "imp_2",
      claim: "The commission hearing was held in Room 210.",
      claimType: "fact",
      dates: {},
    };

    const highImp = calculateImportanceScore(highImportanceClaim);
    const lowImp = calculateImportanceScore(trivialClaim);

    expect(highImp).toBeGreaterThanOrEqual(8.0);
    expect(lowImp).toBeLessThanOrEqual(5.5);
    expect(highImp).toBeGreaterThan(lowImp);
  });

  // TEST E: PRINCIPLE 5 — GENERIC CAUSAL VALIDATION ACROSS ARBITRARY DOMAINS
  it("TEST E: validates causal claims across economics, environmental science, and chemistry", () => {
    // 1. Economics
    const econCheck = validateCausalStatement(
      "High global oil prices caused the inflation spike in India.",
      false,
    );
    expect(econCheck.isCausalClaim).toBe(true);
    expect(econCheck.classification).toBe("CORRELATION");
    expect(econCheck.suggestedWording).toContain("likely contributed to");

    // 2. Chemistry / Mechanistic
    const chemCheck = validateCausalStatement(
      "Advanced titanium dioxide photocatalytically oxidizes organic pollutants.",
      false,
    );
    expect(chemCheck.isCausalClaim).toBe(true);
    expect(chemCheck.classification).toBe("MECHANISTIC");
    expect(chemCheck.supportedByDirectEvidence).toBe(true);

    // 3. Environmental science
    const envCheck = validateCausalStatement(
      "Phosphorus runoff induced severe algal blooms in the reservoir.",
      false,
    );
    expect(envCheck.isCausalClaim).toBe(true);
    expect(envCheck.suggestedWording).toContain("was associated with");
  });

  // TEST F: PRINCIPLE 6 — EVENT DATE VS PUBLICATION DATE SEPARATION
  it("TEST F: allows retrospective historical analysis reports while enforcing event-window boundaries", () => {
    const historicalCrisisTask = resolveResearchScope("What caused the 2008 financial crisis?");
    expect(historicalCrisisTask.intent).toBe("historical_cause");
    expect(historicalCrisisTask.temporalScope.cutoffPolicy).toBe("retrospective_allowed");

    // Government commission inquiry report published in 2011 analyzing 2008 event
    const fcicReport = evaluateSource({
      url: "https://fcic.gov/report",
      title: "The Financial Crisis Inquiry Report",
      publishedDateHint: "January 27, 2011",
      rawSnippet: "Investigating the causes of the 2008 financial and economic collapse.",
    });

    const validation = validateSourceTemporalWindow(fcicReport, historicalCrisisTask);
    expect(validation.status).toBe("valid");

    // Strict cutoff query for comparison
    const strictTask = resolveResearchScope("Developments up to 2023");
    const strictValidation = validateSourceTemporalWindow(
      evaluateSource({
        url: "https://example.com/2024-article",
        title: "2024 Tech Update",
        publishedDateHint: "2024-05-10",
      }),
      strictTask,
    );
    expect(strictValidation.status).toBe("rejected_out_of_window");
  });

  // TEST G: PRINCIPLE 7 — GENERIC QUANTITATIVE ENGINE ACROSS ARBITRARY DOMAINS
  it("TEST G: extracts units, categories, and baselines across battery, wastewater, and cloud domains", () => {
    // 1. Battery density
    const battery = extractNumericalData(
      "Silicon-anode pouch cell reached 450 Wh/kg compared to 260 Wh/kg for standard lithium cells.",
    );
    expect(battery).toBeDefined();
    expect(battery?.unit).toBe("Wh/kg");
    expect(battery?.numericValue).toBe(450);
    expect(battery?.baseline).toContain("standard lithium cells");

    // 2. Wastewater BOD concentration
    const water = extractNumericalData(
      "Membrane bioreactor reduced effluent BOD to 15 mg/L under standard municipal flow.",
    );
    expect(water).toBeDefined();
    expect(water?.unit).toBe("mg/L");
    expect(water?.numericValue).toBe(15);
    expect(water?.conditions).toContain("municipal flow");

    // 3. Cloud storage pricing
    const cloud = extractNumericalData(
      "Startup cloud storage priced at $0.02 per GB relative to legacy block storage.",
    );
    expect(cloud).toBeDefined();
    expect(cloud?.category).toBe("currency");
    expect(cloud?.baseline).toContain("legacy block storage");

    // 4. Financial crisis stimulus
    const finance = extractNumericalData(
      "Emergency fiscal stabilization program authorized $700 billion.",
    );
    expect(finance).toBeDefined();
    expect(finance?.category).toBe("currency");
    expect(finance?.numericValue).toBe(700000000000);
  });

  // TEST H: PRINCIPLE 8 — ACTIVE COUNTER-EVIDENCE RECORDING & PENALIZATION
  it("TEST H: records counter-evidence and penalizes claim confidence score accordingly", () => {
    const primarySource = evaluateSource({
      url: "https://cleanenergy.org/solid-state-breakthrough",
      title: "Breakthrough Solid-State Battery Achieves 1000 Cycles",
    });

    const uncontestedClaim = createLedgerEntry({
      claim: {
        id: "c_uncontested",
        claim: "Solid-state electrolyte achieved 1000 cycles at room temperature.",
        claimType: "fact",
        dates: {},
      },
      supportingSources: [primarySource],
      contradictions: [],
      temporalStatus: "valid",
    });

    const contestedClaim = createLedgerEntry({
      claim: {
        id: "c_contested",
        claim: "Solid-state electrolyte achieved 1000 cycles at room temperature.",
        claimType: "fact",
        dates: {},
      },
      supportingSources: [primarySource],
      contradictions: [],
      temporalStatus: "valid",
      counterEvidence: ["Independent battery consortium failed to replicate cycle life above 300 cycles."],
    });

    expect(contestedClaim.counterEvidence.length).toBe(1);
    expect(contestedClaim.confidenceScore).toBeLessThan(uncontestedClaim.confidenceScore);
  });

  // TEST I: PRINCIPLE 9 — 16-POINT AUDIT & QUALITY METRICS CALCULATION
  it("TEST I: executes complete 16-point audit and calculates research quality metrics", () => {
    const scope = resolveResearchScope("What were the biggest breakthroughs in battery technology from 2020 to 2026?");
    const source = evaluateSource({
      url: "https://nature.com/articles/battery-review-2024",
      title: "Progress in Solid-State Battery Interfaces",
      publishedDateHint: "2024-03-12",
      rawSnippet: "Review of solid electrolyte interphase stability in lithium metal cells.",
    });

    const entry = createLedgerEntry({
      claim: {
        id: "claim_i1",
        claim: "Solid electrolyte interphase engineering extended lithium metal pouch cell cyclability.",
        claimType: "fact",
        dates: {},
      },
      supportingSources: [source],
      contradictions: [],
      temporalStatus: "valid",
    });

    const ledger: EvidenceLedger = {
      entries: [entry],
      unverifiedClaims: [],
      rejectedSources: [],
      contradictions: [],
    };

    const { reportText, bibliography } = synthesizeResearchReport({
      scope,
      ledger,
      rankedCandidates: [],
    });

    const audit = runResearchAudit({
      scope,
      ledger,
      rankedCandidates: [],
      reportText,
      bibliographySources: bibliography,
    });

    // 16 distinct programmatic audit checks
    expect(audit.checks).toBeDefined();
    expect(Object.keys(audit.checks).length).toBe(16);
    expect(audit.checks.unsupportedClaims.passed).toBe(true);
    expect(audit.checks.temporalViolations.passed).toBe(true);
    expect(audit.checks.numericalContext.passed).toBe(true);
    expect(audit.checks.unsupportedCausalClaims.passed).toBe(true);

    // Research quality metrics
    expect(audit.metrics).toBeDefined();
    expect(audit.metrics.evidenceCoverageRate).toBe(1.0);
    expect(audit.metrics.citationGroundingRate).toBe(1.0);
    expect(audit.metrics.temporalComplianceRate).toBe(1.0);
    expect(audit.metrics.researchCompletenessScore).toBeGreaterThanOrEqual(8.0);
    expect(audit.recommendedAction).toBe("PROCEED_TO_PUBLISH");
  });

  // TEST J: PRINCIPLE 10 — ADAPTIVE REPORT FORMATS
  it("TEST J: dynamically adapts report layout for comparison, causal, and ranking intents", () => {
    // 1. Comparison Layout
    const compTask = resolveResearchScope("Compare AWS, Azure and GCP for startups");
    expect(compTask.outputFormat).toBe("comparison");
    const compReport = synthesizeResearchReport({
      scope: compTask,
      ledger: { entries: [], unverifiedClaims: [], rejectedSources: [], contradictions: [] },
      rankedCandidates: [],
    });
    expect(compReport.reportText).toContain("Comparative Evaluation Matrix");
    expect(compReport.reportText).toContain("| Evaluation Dimension |");

    // 2. Causal Investigation Layout
    const causalTask = resolveResearchScope("What caused the 2008 financial crisis?");
    expect(causalTask.outputFormat).toBe("causal_investigation");
    const causalReport = synthesizeResearchReport({
      scope: causalTask,
      ledger: { entries: [], unverifiedClaims: [], rejectedSources: [], contradictions: [] },
      rankedCandidates: [],
    });
    expect(causalReport.reportText).toContain("Causal Mechanism & Root Cause Investigation");
    expect(causalReport.reportText).toContain("Root Cause Architecture");

    // 3. Ranking Layout
    const rankTask = resolveResearchScope("What were the biggest breakthroughs in battery technology from 2020 to 2026?");
    expect(rankTask.outputFormat).toBe("ranking");
    const rankReport = synthesizeResearchReport({
      scope: rankTask,
      ledger: { entries: [], unverifiedClaims: [], rejectedSources: [], contradictions: [] },
      rankedCandidates: [],
    });
    expect(rankReport.reportText).toContain("Ranked Developments & Strategic Breakthroughs");
  });

  // TEST K: MULTI-INTENT CANDIDATE DISCOVERY
  it("TEST K: generates multi-intent query plans across discovery, primary, corroboration, and counter-evidence pillars", () => {
    const plan = generateMultiIntentSearchPlan(
      "What were the biggest breakthroughs in battery technology from 2020 to 2026?",
    );

    expect(plan.pillars.discovery.length).toBeGreaterThan(0);
    expect(plan.pillars.primaryVerification.length).toBeGreaterThan(0);
    expect(plan.pillars.independentCorroboration.length).toBeGreaterThan(0);
    expect(plan.pillars.counterEvidenceSearch.length).toBeGreaterThan(0);

    // Counter-evidence pillar specifically targets disconfirmation
    const counterQueries = plan.pillars.counterEvidenceSearch.join(" ");
    expect(counterQueries.toLowerCase()).toMatch(/limitations|challenges|failure|degradation|safety/);
  });

  // TEST L: BATTERY BREAKTHROUGHS DOMAIN VERIFICATION
  it("TEST L: resolves battery research scope, derives technical dimensions, and enforces 2020-2026 window", () => {
    const task = resolveResearchScope(
      "What were the biggest breakthroughs in battery technology from 2020–2026?",
    );

    expect(task.temporalScope.startDate).toBe("2020-01-01");
    expect(task.temporalScope.endDate).toBe("2026-01-01");
    expect(task.comparisonDimensions).toContain("Technical Efficiency & Performance");
    expect(task.comparisonDimensions).toContain("Safety & Environmental Impact");
    expect(task.rankingRequired).toBe(true);
  });

  // TEST M: CLOUD PROVIDERS STARTUP COMPARISON VERIFICATION
  it("TEST M: extracts cloud provider entities and derives cost/developer-experience dimensions", () => {
    const task = resolveResearchScope("Compare the leading cloud providers for startups");

    expect(task.intent).toBe("comparison");
    expect(task.comparisonDimensions).toContain("Cost & Pricing Structure");
    expect(task.comparisonDimensions).toContain("Developer Experience & Ecosystem");
    expect(task.rankingRequired).toBe(false);
  });

  // TEST N: WASTEWATER TREATMENT APPROACHES VERIFICATION
  it("TEST N: derives engineering and environmental dimensions for wastewater treatment query", () => {
    const task = resolveResearchScope("Research the best approaches for treating wastewater.");

    expect(task.comparisonDimensions).toContain("Manufacturing Scalability & Cost");
    expect(task.comparisonDimensions).toContain("Safety & Environmental Impact");
  });

  // TEST O: INFLATION IN INDIA GEOGRAPHIC AND CAUSAL SCOPE VERIFICATION
  it("TEST O: extracts geographic scope (India) and economic causal dimensions", () => {
    const task = resolveResearchScope("What are the major causes of inflation in India?");

    expect(task.geographicScope).toBe("India");
    expect(task.intent).toBe("historical_cause");
    expect(task.comparisonDimensions).toContain("Root Structural Vulnerabilities");
    expect(task.comparisonDimensions).toContain("Immediate Catalyst Triggers");
  });
});

