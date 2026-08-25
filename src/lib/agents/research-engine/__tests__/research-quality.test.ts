/**
 * Research Quality & Canonical Source Verification Regression Suite
 * Remispace Deep Research Agent
 * 
 * Verifies all 8 core failure cases & regression dimensions:
 * - Test 1: Source Entity Resolution & Deduplication (resolving arXiv + PDF + Web into 1 canonical source)
 * - Test 2: Publication Year vs Preprint Year Resolution (preventing wrong years like 2026 for 2022 papers)
 * - Test 3: Wrong Paper Attribution Rejection (RUDDER vs related sparse rewards paper)
 * - Test 4: Invented Experimental Context Cleansing ("assumed standard GPU" -> "Not reported in the source")
 * - Test 5: Metric Drift Detection & Semantic Preservation ("best scores" vs "final reward")
 * - Test 6: Mathematical Formulation Labeling & Fidelity
 * - Test 7: Context Mismatch & Overgeneralization (GPT-2 vs frontier LLMs)
 * - Test 8: Cross-Paper Comparison Qualification (direct vs indirect)
 * - Test 9: Research Gap Verification & Epistemic Calibration
 * - Test 10: Canonical Reference Bibliography Rendering (zero duplicate citations)
 * - Test 11: Quality Gate 9-Pillar Weighted Scoring
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CanonicalSourceRegistry,
  verifyNumericalClaim,
  auditMetricDrift,
  sanitizeExperimentalContext,
  auditContextMismatch,
  auditCrossPaperComparison,
  auditAndCalibrateText,
  auditCitationEntailment,
  evaluateResearchQualityGate,
  type ClaimEvidenceLedgerItem,
} from "../index";

describe("Deep Research Agent — Research Quality & Canonical Source Verification", () => {
  // Test 1: Source Entity Resolution & Deduplication
  it("Test 1: Source Entity Resolution — deduplicates same paper across arXiv, HTML, and Conference URLs", () => {
    const registry = new CanonicalSourceRegistry();

    // 1. First discovered via arXiv search
    const s1 = registry.registerSource({
      title: "RUDDER: Return Decomposition for Delayed Rewards",
      url: "https://arxiv.org/abs/1906.07073",
      arxivId: "1906.07073",
      year: 2019,
      authors: ["Jose A. Arjona-Medina", "Michael Gillhofer", "Michael Widrich", "Sepp Hochreiter"],
      type: "arXiv Paper",
    });

    // 2. Discovered via NeurIPS conference proceedings
    const s2 = registry.registerSource({
      title: "RUDDER: Return Decomposition for Delayed Rewards",
      url: "https://proceedings.neurips.cc/paper/2019/hash/rudder.html",
      venue: "NeurIPS 2019",
      year: 2019,
      authors: ["J. Arjona-Medina", "M. Gillhofer", "M. Widrich", "S. Hochreiter"],
      type: "Conference",
    });

    // 3. Discovered via PDF download link
    const s3 = registry.registerSource({
      title: "[PDF] RUDDER: Return Decomposition for Delayed Rewards - arXiv",
      url: "https://arxiv.org/pdf/1906.07073.pdf",
      year: 2019,
      authors: ["Arjona-Medina et al."],
      type: "arXiv",
    });

    assert.equal(s1.source_id, s2.source_id);
    assert.equal(s2.source_id, s3.source_id);
    assert.equal(registry.getAllSources().length, 1);
    assert.equal(s1.venue, "NeurIPS 2019");
    assert.equal(s1.tierRank, 1); // Upgraded to Tier 1 via NeurIPS venue
    assert.equal(s1.retrieved_urls.length, 3);
  });

  // Test 2: Publication Year vs Preprint Year Resolution
  it("Test 2: Publication Year Resolution — resolves preprint vs conference publication without arbitrary 2026 dates", () => {
    const registry = new CanonicalSourceRegistry();

    const s = registry.registerSource({
      title: "Off-Policy Reinforcement Learning with Delayed Rewards",
      url: "https://arxiv.org/abs/2106.12345",
      arxivId: "2106.12345",
      year: 2021,
      authors: ["Author A", "Author B"],
      type: "arXiv Paper",
    });

    registry.registerSource({
      title: "Off-Policy Reinforcement Learning with Delayed Rewards",
      url: "https://icml.cc/virtual/2022/poster/123",
      venue: "ICML 2022",
      year: 2022,
      authors: ["Author A", "Author B"],
      type: "Conference",
    });

    assert.equal(s.preprint_year, 2021);
    assert.equal(s.publication_year, 2022);
    assert.ok(!s.yearOrId.includes("2026"));
  });

  // Test 3: Wrong Paper Attribution Rejection
  it("Test 3: Wrong Paper Attribution — rejects citing a 2024 related paper as the creator of RUDDER", () => {
    const registry = new CanonicalSourceRegistry();

    const relatedPaper = registry.registerSource({
      title: "Revisiting Sparse Rewards for Goal-Reaching Reinforcement Learning",
      url: "https://arxiv.org/abs/2402.00001",
      year: 2024,
      authors: ["Researcher X", "Researcher Y"],
      type: "arXiv Paper",
    });

    const mockLedger: ClaimEvidenceLedgerItem[] = [
      {
        claim_id: "claim_1",
        claim: "Revisiting Sparse Rewards introduces the RUDDER algorithm for reward redistribution.",
        claim_type: "factual",
        importance: "core",
        source_ids: [relatedPaper.source_id],
        source_quality: relatedPaper.source_tier,
        source_title: relatedPaper.canonical_title,
        source_url: relatedPaper.canonical_url,
        source_type: relatedPaper.source_type,
        publication_year: 2024,
        exact_support: "We compare our goal-reaching baseline against prior work including RUDDER.",
        paper_contribution_vs_related: "related_concept", // Merely cited/evaluated
        support_level: "UNSUPPORTED",
        confidence: "LOW",
        verification_status: "UNSUPPORTED",
      },
    ];

    const reportText = `The algorithm was proposed in Revisiting Sparse Rewards for Goal-Reaching Reinforcement Learning (Researcher X, 2024).`;
    const audit = auditCitationEntailment(reportText, mockLedger, [relatedPaper]);

    assert.equal(audit.wrongPaperAttributionCount, 1);
    assert.equal(audit.unsupportedCount, 1);
    assert.ok(audit.auditItems[0]?.reason.includes("Wrong paper attribution"));
  });

  // Test 4: Invented Experimental Context Cleansing
  it("Test 4: Anti-Invented Context — cleanses 'assumed standard GPU' to explicit 'Not reported in the source'", () => {
    const check1 = sanitizeExperimentalContext("Hardware: Not specified (assumed standard GPU clusters)");
    assert.equal(check1.wasInvented, true);
    assert.equal(check1.value, "Not reported in the source");

    const text = "The authors evaluated training efficiency. Hardware: (assumed standard GPU clusters). Batch size: likely 32.";
    const calibrated = auditAndCalibrateText(text);

    assert.ok(calibrated.calibratedText.includes("Hardware: Not reported in the source"));
    assert.ok(!calibrated.calibratedText.includes("assumed standard GPU"));
    assert.ok(calibrated.inventedContextsCleansed >= 1);
  });

  // Test 5: Metric Drift Detection & Semantic Preservation
  it("Test 5: Metric Drift — flags transforming 'best scores' into 'final reward'", () => {
    const claim = "The method achieved a 4x final reward improvement.";
    const exactSupport = "We observed up to 4x improvement in reaching higher best scores across Atari environments.";

    const driftCheck = auditMetricDrift(claim, exactSupport);

    assert.equal(driftCheck.hasDrift, true);
    assert.ok(driftCheck.warning?.includes("Metric drift"));
    assert.ok(driftCheck.calibratedClaim?.includes("peak best-score attainment"));

    const numCheck = verifyNumericalClaim(claim, exactSupport, exactSupport);
    assert.equal(numCheck.metricDriftDetected, true);
    assert.equal(numCheck.verificationStatus, "PARTIALLY_SUPPORTED");
  });

  // Test 6: Mathematical Formulation Fidelity
  it("Test 6: Mathematical Fidelity — ensures generic equations are labeled as background formulation", () => {
    const text = `The method is defined by the following exact formulation:
$$
V(s) = \\mathbb{E} [R_{t+1} + \\gamma V(S_{t+1}) | S_t = s]
$$`;

    const result = auditAndCalibrateText(text);

    assert.ok(result.calibratedText.includes("Theoretical formulation synthesized from reviewed literature:"));
    assert.ok(!result.calibratedText.includes("The method is defined by the following exact formulation"));
  });

  // Test 7: Context Mismatch & Overgeneralization
  it("Test 7: Context Mismatch — catches when GPT-2 evaluation is claimed for all frontier LLMs", () => {
    const claim = "The optimization universally accelerates all modern LLMs.";
    const ledgerItem: Partial<ClaimEvidenceLedgerItem> = {
      model: "GPT-2 (117M)",
      dataset: "WikiText-2",
      what_source_showed: "Demonstrated speedup on GPT-2 small architecture",
      what_source_did_not_show: "Not tested on modern 70B+ LLMs or Mixture-of-Experts",
    };

    const mismatch = auditContextMismatch(claim, ledgerItem);
    assert.equal(mismatch.hasMismatch, true);
    assert.ok(mismatch.calibratedClaim?.includes("GPT-2"));
  });

  // Test 8: Cross-Paper Comparison Qualification
  it("Test 8: Cross-Paper Comparison — distinguishes direct from indirect cross-study comparisons", () => {
    const itemA: ClaimEvidenceLedgerItem = {
      claim_id: "c1",
      claim: "Method A achieves 50 ms latency.",
      claim_type: "numerical",
      importance: "core",
      source_ids: ["s1"],
      source_quality: "Tier 1: Peer-Reviewed Journal / Top Conference",
      source_title: "Paper A",
      source_url: "https://arxiv.org/abs/1",
      source_type: "Paper",
      publication_year: 2024,
      exact_support: "50 ms on LLaMA-3-8B with A100",
      model: "LLaMA-3-8B",
      hardware: "NVIDIA A100",
      dataset: "GSM8K",
      support_level: "DIRECTLY_SUPPORTED",
      confidence: "HIGH",
      verification_status: "VERIFIED",
    };

    const itemB: ClaimEvidenceLedgerItem = {
      claim_id: "c2",
      claim: "Method B achieves 35 ms latency.",
      claim_type: "numerical",
      importance: "core",
      source_ids: ["s2"],
      source_quality: "Tier 1: Peer-Reviewed Journal / Top Conference",
      source_title: "Paper B",
      source_url: "https://arxiv.org/abs/2",
      source_type: "Paper",
      publication_year: 2024,
      exact_support: "35 ms on Gemma-2B with H100",
      model: "Gemma-2B",
      hardware: "NVIDIA H100",
      dataset: "MMLU",
      support_level: "DIRECTLY_SUPPORTED",
      confidence: "HIGH",
      verification_status: "VERIFIED",
    };

    const comparison = auditCrossPaperComparison(itemA, itemB);
    assert.equal(comparison.isDirect, false);
    assert.ok(comparison.note.includes("Indirect comparison"));
  });

  // Test 9: Research Gap Verification & Epistemic Calibration
  it("Test 9: Research Gap Verification — calibrates unhedged 'No method exists' claims", () => {
    const text = "Currently, no method exists to solve delayed reward credit assignment.";
    const result = auditAndCalibrateText(text);

    assert.ok(result.calibratedText.includes("the reviewed literature does not establish a standardized approach"));
    assert.ok(!result.calibratedText.includes("no method exists"));
  });

  // Test 10: Canonical Reference Bibliography Rendering
  it("Test 10: Canonical Reference Generation — renders deduplicated bibliography strictly from registry", () => {
    const registry = new CanonicalSourceRegistry();

    registry.registerSource({
      title: "FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning",
      url: "https://arxiv.org/abs/2307.08691",
      arxivId: "2307.08691",
      year: 2023,
      venue: "ICLR 2024",
      authors: ["Tri Dao"],
      type: "arXiv",
    });

    registry.registerSource({
      title: "FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning",
      url: "https://arxiv.org/pdf/2307.08691.pdf",
      arxivId: "2307.08691",
      year: 2023,
      authors: ["Tri Dao"],
      type: "arXiv",
    });

    const bibliography = registry.renderCanonicalBibliography(10);

    assert.ok(bibliography.includes("### Sources & Literature References"));
    assert.ok(bibliography.includes("FlashAttention-2"));
    assert.ok(bibliography.includes("Tri Dao"));
    // Verify only ONE numbered item rendered despite 2 registrations
    const matches = bibliography.match(/^\d+\.\s/gm);
    assert.equal(matches?.length, 1);
  });

  // Test 11: Quality Gate 9-Pillar Weighted Scoring
  it("Test 11: Quality Gate Scoring — evaluates all 9 weighted quality pillars", () => {
    const registry = new CanonicalSourceRegistry();

    const s = registry.registerSource({
      title: "Direct Preference Optimization",
      url: "https://arxiv.org/abs/2305.18290",
      venue: "NeurIPS 2023",
      year: 2023,
      authors: ["Rafael Rafailov", "Archit Sharma", "Eric Mitchell", "Stefano Ermon", "Christopher D. Manning", "Chelsea Finn"],
      type: "Conference",
    });

    const mockLedger: ClaimEvidenceLedgerItem[] = [
      {
        claim_id: "c1",
        claim: "DPO implicitly optimizes the Bradley-Terry preference model without a reinforcement learning loop.",
        claim_type: "theoretical",
        importance: "core",
        source_ids: [s.source_id],
        source_quality: s.source_tier,
        source_title: s.canonical_title,
        source_url: s.canonical_url,
        source_type: s.source_type,
        publication_year: 2023,
        exact_support: "DPO derives a closed-form expression for the optimal policy under the Bradley-Terry preference model.",
        support_level: "DIRECTLY_SUPPORTED",
        confidence: "HIGH",
        verification_status: "VERIFIED",
      },
    ];

    const metrics = evaluateResearchQualityGate({
      ledger: mockLedger,
      sources: registry.getAllSources(),
      citationAudit: {
        totalCitationsAudited: 1,
        verifiedCount: 1,
        partiallySupportedCount: 0,
        unsupportedCount: 0,
        wrongPaperAttributionCount: 0,
        citationEntailmentRatio: 1.0,
        auditItems: [],
      },
      contradictionsCount: 1,
      uncalibratedTermsCount: 0,
      inventedContextsCount: 0,
    });

    assert.equal(metrics.passedQualityGate, true);
    assert.equal(metrics.overallScore >= 80, true);
    assert.equal(metrics.citationCorrectnessScore, 1.0);
    assert.equal(metrics.claimEvidenceSupportScore, 1.0);
    assert.equal(metrics.sourceIdentityMetadataScore, 1.0);
  });
});
