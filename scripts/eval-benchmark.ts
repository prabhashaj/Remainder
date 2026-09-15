import {
  resolveResearchScope,
  generateLandscapeCandidates,
  evaluateSource,
  validateSourceTemporalWindow,
  splitIntoAtomicClaims,
  isClaimSupportedBySource,
  detectContradictionBetweenSources,
  createLedgerEntry,
  rankCandidates,
  synthesizeResearchReport,
  runResearchAudit,
  type SourceMetadata,
  type EvidenceLedger,
  type CandidateEvaluationInput,
  type ContradictionRecord,
} from "../src/lib/agents/deep-research";

async function runBenchmarkEvaluation() {
  console.log("============================================================");
  console.log("RUNNING END-TO-END BENCHMARK RESEARCH EVALUATION");
  console.log("Prompt: 'What were the biggest AI upgrades between January 1, 2025 and September 15, 2026?'");
  console.log("============================================================\n");

  // 1. Resolve Scope
  const question = "What were the biggest AI upgrades between January 1, 2025 and September 15, 2026?";
  const scope = resolveResearchScope(question);

  console.log(`[1] Research Scope Resolved:`);
  console.log(`    - Topic: ${scope.topic}`);
  console.log(`    - Start Date: ${scope.startDate}`);
  console.log(`    - End Date (Cutoff): ${scope.endDate}`);
  console.log(`    - Ranking Required: ${scope.rankingRequired}`);
  console.log(`    - Domains Covered (${scope.domains.length}): ${scope.domains.slice(0, 4).join(", ")}...`);

  // 2. Candidate Discovery across the landscape
  const candidatesDiscovered = generateLandscapeCandidates(scope);
  console.log(`\n[2] Candidate Discovery:`);
  console.log(`    - Total Landscape Candidates Discovered: ${candidatesDiscovered.length}`);
  console.log(`    - Domains Represented: ${Array.from(new Set(candidatesDiscovered.map((c) => c.domain))).length}`);

  // 3. Simulated Multi-Source Retrieval Pool (representing arXiv, Official, Labs, Secondary, and Out-of-Window items)
  const mockRetrievedSources = [
    // Tier 1 - In-Window Primary
    {
      url: "https://openai.com/index/o1-system-card/",
      title: "OpenAI o1 System Card & Evaluation Methodology",
      publishedDateHint: "2025-01-10",
      rawSnippet: "OpenAI o1 utilizes reinforcement learning to generate deliberative chain-of-thought before finalizing responses, demonstrating substantial gains on competitive math and SWE-bench.",
    },
    {
      url: "https://arxiv.org/abs/2502.04567",
      title: "DeepSeek-V3 Technical Report: Architecture & Training",
      publishedDateHint: "2025-02-05",
      rawSnippet: "DeepSeek-V3 features a 671B MoE architecture activating 37B parameters per token using Multi-Head Latent Attention (MLA) and DeepSeekMoE dual-pipe routing.",
    },
    {
      url: "https://anthropic.com/research/swe-bench-agent-evaluations",
      title: "Frontier Coding Agents on SWE-bench Verified",
      publishedDateHint: "2025-04-12",
      rawSnippet: "Autonomous agents utilizing sandboxed execution environments resolved over 52% of verified multi-file GitHub issues compared to under 18% in late 2023.",
    },
    {
      url: "https://arxiv.org/abs/2506.09871",
      title: "KV-Cache Compression via Latent Projections in Frontier LLMs",
      publishedDateHint: "2025-06-20",
      rawSnippet: "MLA compresses KV-cache memory bandwidth consumption by 82% compared to standard MHA, allowing 4x larger concurrent batch sizes.",
    },
    // Tier 2 - Independent Benchmark
    {
      url: "https://lmsys.org/blog/2025-07-arena-update/",
      title: "Chatbot Arena Reasoning Model Leaderboard & ELO Shifts",
      publishedDateHint: "2025-07-15",
      rawSnippet: "LMSYS Chatbot Arena records test-time reasoning models crossing 1350 ELO, establishing a new Pareto frontier across coding and math.",
    },
    // Tier 3 - Secondary Source
    {
      url: "https://techcrunch.com/2025/08/01/ai-inference-cost-reduction/",
      title: "How Open Weight MoEs Slashed Cloud Inference Costs",
      publishedDateHint: "2025-08-01",
      rawSnippet: "Cloud providers slashed token pricing by up to 80% following the widespread deployment of sparse open-weights models.",
    },
    // Out-of-Window Post-Cutoff Source (October 2026 - Cutoff is Sept 15, 2026)
    {
      url: "https://future-ai-tech.com/2026/10/05/next-gen-breakthrough/",
      title: "Post-Cutoff Speculation on 2027 Architectures",
      publishedDateHint: "2026-10-05",
      rawSnippet: "A new neural breakthrough announced in October 2026 claims 5x speedup across quantum-classical hybrid clusters.",
    },
    // Conflicting Source on parameters (700B vs 671B)
    {
      url: "https://unverified-tech-aggregator.com/leak-v3",
      title: "Unverified Rumor on DeepSeek Architecture",
      publishedDateHint: "2025-02-06",
      rawSnippet: "DeepSeek-V3 reportedly trained a 500B parameters model without multi-token prediction.",
    },
  ];

  // Evaluate & Gating
  const evaluatedSources: SourceMetadata[] = [];
  const rejectedSources: Array<{ source: SourceMetadata; reason: string }> = [];

  for (const raw of mockRetrievedSources) {
    const meta = evaluateSource(raw);
    const temporalCheck = validateSourceTemporalWindow(meta, scope);
    if (temporalCheck.status === "rejected_out_of_window") {
      rejectedSources.push({ source: meta, reason: temporalCheck.reason || "Out of window" });
    } else {
      evaluatedSources.push(meta);
    }
  }

  console.log(`\n[3] Source Quality & Temporal Audit:`);
  console.log(`    - Total Sources Evaluated: ${mockRetrievedSources.length}`);
  console.log(`    - Valid In-Window Sources: ${evaluatedSources.length}`);
  console.log(`    - Rejected Post-Cutoff Sources: ${rejectedSources.length}`);
  for (const rej of rejectedSources) {
    console.log(`      * REJECTED: [${rej.source.title}] (${rej.source.publicationDate}) -> Reason: ${rej.reason}`);
  }

  // Tier Distribution
  const tierCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const s of evaluatedSources) {
    tierCounts[s.sourceTier] = (tierCounts[s.sourceTier] || 0) + 1;
  }
  console.log(`    - Source-Tier Distribution (In-Window):`);
  console.log(`      * Tier 1 (Primary / Papers / Official): ${tierCounts[1]}`);
  console.log(`      * Tier 2 (High-Quality Independent): ${tierCounts[2]}`);
  console.log(`      * Tier 3 (Secondary Publications): ${tierCounts[3]}`);
  console.log(`      * Tier 4 (Low-Confidence / Forums): ${tierCounts[4]}`);

  // 4. Atomic Claim Extraction & Contradiction Detection
  console.log(`\n[4] Claim Verification & Contradiction Detection:`);
  const claimsPool: string[] = [
    "OpenAI o1 spends test-time compute on chain-of-thought exploration, yielding substantial accuracy gains on competition math.",
    "DeepSeek-V3 features a 671B parameters MoE architecture activating 37B parameters per token.",
    "Autonomous coding agents resolved over 52% of verified multi-file GitHub issues on SWE-bench.",
    "MLA compresses KV-cache memory bandwidth consumption by 82% compared to standard MHA on frontier models.",
    "LMSYS Chatbot Arena records test-time reasoning models crossing 1350 ELO.",
    "Quantum-AI processor achieved room-temperature superconductivity in 2025.", // Empty evidence test
  ];

  const ledgerEntries = [];
  const unverifiedClaims = [];
  const detectedContradictions: ContradictionRecord[] = [];

  // Check contradiction between DeepSeek-V3 official (671B) and leak (500B)
  const officialV3 = evaluatedSources.find((s) => s.url.includes("deepseek-v3"));
  const leakV3 = evaluatedSources.find((s) => s.url.includes("leak-v3"));
  if (officialV3 && leakV3) {
    const c = detectContradictionBetweenSources(
      "DeepSeek-V3 has 671B parameters.",
      officialV3,
      "DeepSeek-V3 has 500B parameters.",
      leakV3,
      "DeepSeek-V3 Parameters",
    );
    if (c) detectedContradictions.push(c);
  }

  for (const claimText of claimsPool) {
    const atomicClaims = splitIntoAtomicClaims(claimText);
    for (const ac of atomicClaims) {
      const supporting = evaluatedSources.filter((s) => isClaimSupportedBySource(ac, s).supported);
      if (supporting.length > 0) {
        const entry = createLedgerEntry({
          claim: ac,
          supportingSources: supporting,
          contradictions: detectedContradictions,
          temporalStatus: "valid",
        });
        ledgerEntries.push(entry);
      } else {
        unverifiedClaims.push(ac.claim);
      }
    }
  }

  console.log(`    - Atomic Claims Extracted: ${claimsPool.length}`);
  console.log(`    - Verified Claims Grounded in Evidence: ${ledgerEntries.length}`);
  console.log(`    - Unverified Claims Detected & Quarantined: ${unverifiedClaims.length}`);
  for (const u of unverifiedClaims) {
    console.log(`      * QUARANTINED: "${u}" -> Reason: Zero reliable sources.`);
  }
  console.log(`    - Contradictions Detected: ${detectedContradictions.length}`);
  for (const c of detectedContradictions) {
    console.log(`      * CONTRADICTION: [${c.topicOrEntity}] ${c.claimA.statement} vs ${c.claimB.statement}`);
    console.log(`        Resolution: ${c.resolution}`);
  }

  // 5. Explicit Impact Ranking
  console.log(`\n[5] Explicit 7-Dimension Impact Scoring & Ranking:`);
  const candidateInputs: CandidateEvaluationInput[] = [
    {
      name: "Test-Time Compute & Deliberative Reasoning (o1 / R1)",
      domain: "Model Architectures",
      whatChanged: "Shift from pre-training compute to dynamic inference reasoning tokens.",
      whyItMatters: "Decouples mathematical and coding capabilities from static model size.",
      technicalSignificance: "Power-law scaling observed along inference compute duration.",
      realWorldImpact: "High enterprise integration in coding, auditing, and theorem proving.",
      dates: { releaseDate: "2024-09", adoptionDate: "2025" },
      dimensions: {
        technicalNovelty: 9.6,
        capabilityImprovement: 9.4,
        realWorldAdoption: 8.8,
        economicIndustryImpact: 8.9,
        researchSignificance: 9.5,
        breadthOfImpact: 8.8,
        evidenceQuality: 9.2,
      },
      confidenceLevel: "green",
      primaryEvidenceQuote: "Test-time compute scaling laws demonstrate predictable capability increases on math and code.",
      supportingLedgerEntryIds: ledgerEntries.slice(0, 2).map((e) => e.id),
      limitations: "Higher per-query latency and token cost.",
    },
    {
      name: "Sparse Mixture-of-Experts (MoE) Architecture Scaling",
      domain: "Infrastructure & Architectures",
      whatChanged: "Fine-grained routing activating small parameter fractions per token.",
      whyItMatters: "Collapsed inference token costs by up to 80% while retaining 600B+ capacity.",
      technicalSignificance: "Dual-pipe parallelism and multi-token prediction standardization.",
      realWorldImpact: "Reshaped cloud pricing models and expanded open-weights capabilities.",
      dates: { releaseDate: "2024", adoptionDate: "2025" },
      dimensions: {
        technicalNovelty: 8.6,
        capabilityImprovement: 8.8,
        realWorldAdoption: 9.5,
        economicIndustryImpact: 9.6,
        researchSignificance: 8.7,
        breadthOfImpact: 9.0,
        evidenceQuality: 9.1,
      },
      confidenceLevel: "green",
      primaryEvidenceQuote: "DeepSeek-V3 features a 671B MoE architecture activating 37B parameters per token.",
      supportingLedgerEntryIds: ledgerEntries.slice(1, 3).map((e) => e.id),
      limitations: "High host memory capacity requirement.",
    },
    {
      name: "Autonomous Repository-Level Coding Agents",
      domain: "Agents",
      whatChanged: "Multi-file navigation, test execution, and sandboxed patch generation.",
      whyItMatters: "SWE-bench resolution exceeded 50%, transforming developer workflows.",
      technicalSignificance: "Integration of environment execution feedback into agent search tree.",
      realWorldImpact: "Direct integration into commercial enterprise CI/CD and developer IDEs.",
      dates: { releaseDate: "2024-05", adoptionDate: "2025" },
      dimensions: {
        technicalNovelty: 8.3,
        capabilityImprovement: 8.9,
        realWorldAdoption: 8.7,
        economicIndustryImpact: 8.9,
        researchSignificance: 8.1,
        breadthOfImpact: 7.9,
        evidenceQuality: 8.8,
      },
      confidenceLevel: "green",
      primaryEvidenceQuote: "Autonomous agents resolved over 52% of verified multi-file GitHub issues on SWE-bench.",
      supportingLedgerEntryIds: ledgerEntries.slice(2, 4).map((e) => e.id),
      limitations: "High compute consumption on complex loops.",
    },
    {
      name: "KV-Cache Latent Compression (MLA / Dynamic Eviction)",
      domain: "Infrastructure & Hardware",
      whatChanged: "Low-rank latent projection of attention keys and values.",
      whyItMatters: "Overcame GPU memory bandwidth wall, enabling 4x-5x higher concurrency.",
      technicalSignificance: "Reduced per-user KV memory footprint by over 80%.",
      realWorldImpact: "Substantially lowered server hardware footprints for frontier LLM providers.",
      dates: { releaseDate: "2024", adoptionDate: "2025" },
      dimensions: {
        technicalNovelty: 8.0,
        capabilityImprovement: 8.1,
        realWorldAdoption: 8.9,
        economicIndustryImpact: 8.8,
        researchSignificance: 8.0,
        breadthOfImpact: 8.4,
        evidenceQuality: 8.6,
      },
      confidenceLevel: "green",
      primaryEvidenceQuote: "MLA compresses KV-cache memory bandwidth consumption by 82% compared to standard MHA.",
      supportingLedgerEntryIds: ledgerEntries.slice(3, 5).map((e) => e.id),
      limitations: "Requires specialized kernel implementations.",
    },
  ];

  const rankedCandidates = rankCandidates(candidateInputs, 3);
  for (const c of rankedCandidates) {
    const status = c.includedInTopRanking ? `[TOP #${c.rank}]` : `[EXCLUDED #${c.rank}]`;
    console.log(`    ${status} ${c.candidateName} — Score: ${c.impactScore.totalScore}/10.0 (Confidence: ${c.confidenceLevel.toUpperCase()})`);
    if (!c.includedInTopRanking) {
      console.log(`      * Exclusion Rationale: ${c.exclusionReason}`);
    }
  }

  // 6. Synthesis and 11-step audit
  const ledger: EvidenceLedger = {
    entries: ledgerEntries,
    unverifiedClaims,
    rejectedSources,
    contradictions: detectedContradictions,
  };

  const { reportText, bibliography } = synthesizeResearchReport({
    scope,
    ledger,
    rankedCandidates,
  });

  const audit = runResearchAudit({
    scope,
    ledger,
    rankedCandidates,
    reportText,
    bibliographySources: bibliography,
  });

  console.log(`\n[6] Final 11-Dimension Research Audit:`);
  console.log(`    - Overall Status: ${audit.overallPassed ? "PASSED" : "FAILED"}`);
  console.log(`    - Temporal Audit: ${audit.temporalAudit.passed ? "PASS" : "FAIL"} (${audit.temporalAudit.details})`);
  console.log(`    - Source Hierarchy Audit: ${audit.sourceAudit.passed ? "PASS" : "FAIL"} (${audit.sourceAudit.details})`);
  console.log(`    - Claim Verification Audit: ${audit.claimAudit.passed ? "PASS" : "FAIL"} (${audit.claimAudit.details})`);
  console.log(`    - Numerical Baseline Audit: ${audit.numericalAudit.passed ? "PASS" : "FAIL"} (${audit.numericalAudit.details})`);
  console.log(`    - Causal Inference Audit: ${audit.causalAudit.passed ? "PASS" : "FAIL"} (${audit.causalAudit.details})`);
  console.log(`    - Contradiction Audit: ${audit.contradictionAudit.passed ? "PASS" : "FAIL"} (${audit.contradictionAudit.details})`);
  console.log(`    - Explicit Ranking Audit: ${audit.rankingAudit.passed ? "PASS" : "FAIL"} (${audit.rankingAudit.details})`);
  console.log(`    - Citation Grounding Audit: ${audit.citationAudit.passed ? "PASS" : "FAIL"} (${audit.citationAudit.details})`);
  console.log(`    - Bibliography Cleanness Audit: ${audit.bibliographyAudit.passed ? "PASS" : "FAIL"} (${audit.bibliographyAudit.details})`);
  console.log(`    - Uncertainty Audit: ${audit.uncertaintyAudit.passed ? "PASS" : "FAIL"} (${audit.uncertaintyAudit.details})`);

  console.log(`\n============================================================`);
  console.log("BENCHMARK RESEARCH EVALUATION COMPLETED SUCCESSFULLY");
  console.log("============================================================");
}

runBenchmarkEvaluation().catch(console.error);
