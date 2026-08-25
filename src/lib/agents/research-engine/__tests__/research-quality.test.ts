/**
 * Research Quality Verification Test Suite
 * Remispace Deep Research Agent
 * 
 * Verifies all 7 core quality failure modes:
 * - Test 1: Unsupported claim
 * - Test 2: Numerical mismatch
 * - Test 3: Context mismatch
 * - Test 4: Citation mismatch
 * - Test 5: Absolute claim
 * - Test 6: Cross-paper comparison
 * - Test 7: Research gap verification
 * - Test 8: Source tier ranking hierarchy
 * - Test 9: Quality gate scoring
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  classifySourceTier,
  rankAndFilterSources,
  verifyNumericalClaim,
  auditContextMismatch,
  auditCrossPaperComparison,
  auditAndCalibrateText,
  auditCitationEntailment,
  evaluateResearchQualityGate,
  type ClaimEvidenceLedgerItem,
  type ResearchSource,
} from "../index";

describe("Research Quality & Epistemic Verification Engine", () => {
  // Test 1: Unsupported claim
  it("Test 1: Unsupported claim — flags claims when source does not support the claim", () => {
    const claim = "Method X achieves 4.5x faster training throughput than AdamW.";
    const exactSupport = "We evaluated learning rates from 1e-4 to 1e-3 on standard optimizer convergence.";
    const sourceText = "Adam optimizer converges faster than SGD on convex optimization objectives.";

    const result = verifyNumericalClaim(claim, exactSupport, sourceText);

    assert.equal(result.verificationStatus, "UNSUPPORTED");
    assert.equal(result.numberFoundInSource, false);
    assert.ok(result.notes.includes("not found in cited source text"));
  });

  // Test 2: Numerical mismatch
  it("Test 2: Numerical mismatch — flags 99.2% when source says 97.2%", () => {
    const claim = "The model achieved 99.2% accuracy on the MMLU benchmark.";
    const exactSupport = "The evaluated model reached 97.2% top-1 accuracy on MMLU.";
    const sourceText = "Our evaluation on MMLU demonstrates a peak accuracy of 97.2% with 5-shot prompting.";

    const result = verifyNumericalClaim(claim, exactSupport, sourceText);

    assert.equal(result.verificationStatus, "UNSUPPORTED");
    assert.equal(result.numberFoundInSource, false);
    assert.ok(result.extractedFigures.includes("99.2%"));
  });

  // Test 3: Context mismatch
  it("Test 3: Context mismatch — catches when GPT-2 evaluation is claimed for modern frontier LLMs", () => {
    const claim = "Our memory pruning technique improves inference latency across all modern LLMs.";
    const ledgerItem: Partial<ClaimEvidenceLedgerItem> = {
      model: "GPT-2 Small (117M)",
      dataset: "WikiText-103",
      what_source_showed: "Demonstrated 15% latency reduction on GPT-2 small research models",
      what_source_did_not_show: "Not validated on modern 70B+ frontier models or mixture-of-experts architectures",
      evidence_level: "laboratory_experiment",
    };

    const result = auditContextMismatch(claim, ledgerItem);

    assert.equal(result.hasMismatch, true);
    assert.ok(result.mismatchReason?.includes("Context mismatch"));
    assert.ok(result.calibratedClaim?.includes("GPT-2"));
  });

  // Test 4: Citation mismatch
  it("Test 4: Citation mismatch — flags citations where topic is relevant but claim is unsupported", () => {
    const reportText = "Speculative decoding eliminates autoregressive memory bandwidth bottlenecks entirely (Vaswani et al., 2017).";
    
    const mockSources: ResearchSource[] = [
      {
        id: "src_1",
        title: "Attention Is All You Need",
        url: "https://arxiv.org/abs/1706.03762",
        authors: ["Vaswani et al."],
        year: 2017,
        yearOrId: "2017",
        type: "arXiv Paper",
        tier: "Tier 1: Peer-Reviewed Journal / Top Conference",
        tierRank: 1,
        abstractOrSnippet: "We introduce the Transformer, a model architecture relying entirely on an attention mechanism...",
        isPrimarySource: true,
      },
    ];

    const mockLedger: ClaimEvidenceLedgerItem[] = [
      {
        claim_id: "claim_1",
        claim: "Speculative decoding eliminates autoregressive memory bandwidth bottlenecks entirely.",
        claim_type: "empirical",
        importance: "core",
        source_ids: ["src_1"],
        source_quality: "Tier 1: Peer-Reviewed Journal / Top Conference",
        source_title: "Attention Is All You Need",
        source_url: "https://arxiv.org/abs/1706.03762",
        source_type: "arXiv Paper",
        publication_year: 2017,
        exact_support: "The Transformer uses multi-head self-attention.",
        confidence: "LOW",
        verification_status: "UNSUPPORTED",
      },
    ];

    const audit = auditCitationEntailment(reportText, mockLedger, mockSources);

    assert.equal(audit.unsupportedCount, 1);
    assert.equal(audit.auditItems[0]?.status, "UNSUPPORTED");
  });

  // Test 5: Absolute claim calibration
  it("Test 5: Absolute claim — detects unhedged 'No method exists' and calibrates it", () => {
    const text = "Currently, no method exists to prevent attention key-value cache memory growth in autoregressive generation.";

    const result = auditAndCalibrateText(text);

    assert.ok(result.flaggedTerms.length > 0);
    assert.ok(result.calibratedText.includes("the reviewed literature does not establish a standardized approach"));
    assert.equal(result.replacementsCount >= 1, true);
  });

  // Test 6: Cross-paper comparison
  it("Test 6: Cross-paper comparison — tags comparisons between disparate models/hardware as indirect", () => {
    const itemA: ClaimEvidenceLedgerItem = {
      claim_id: "c1",
      claim: "System A processes 120 tokens/sec.",
      claim_type: "numerical",
      importance: "core",
      source_ids: ["s1"],
      source_quality: "Tier 2: arXiv Preprint / Official Lab Publication",
      source_title: "Paper A",
      source_url: "https://arxiv.org/abs/2401.00001",
      source_type: "arXiv Paper",
      publication_year: 2024,
      exact_support: "120 tokens/sec on LLaMA-3-8B with batch size 1 on H100",
      model: "LLaMA-3-8B",
      dataset: "GSM8K",
      hardware: "NVIDIA H100",
      confidence: "HIGH",
      verification_status: "VERIFIED",
    };

    const itemB: ClaimEvidenceLedgerItem = {
      claim_id: "c2",
      claim: "System B processes 95 tokens/sec.",
      claim_type: "numerical",
      importance: "core",
      source_ids: ["s2"],
      source_quality: "Tier 2: arXiv Preprint / Official Lab Publication",
      source_title: "Paper B",
      source_url: "https://arxiv.org/abs/2401.00002",
      source_type: "arXiv Paper",
      publication_year: 2024,
      exact_support: "95 tokens/sec on Mistral-7B with batch size 4 on A100",
      model: "Mistral-7B",
      dataset: "MMLU",
      hardware: "NVIDIA A100",
      confidence: "HIGH",
      verification_status: "VERIFIED",
    };

    const comparison = auditCrossPaperComparison(itemA, itemB);

    assert.equal(comparison.isDirect, false);
    assert.ok(comparison.note.includes("Indirect comparison"));
    assert.ok(comparison.note.includes("different evaluation conditions"));
  });

  // Test 7: Research gap verification
  it("Test 7: Research gap verification — calibrates 'no benchmark exists' to unstandardized coverage", () => {
    const text = "To date, no benchmark exists for evaluating agentic reflection loops.";

    const result = auditAndCalibrateText(text);

    assert.ok(result.calibratedText.includes("standardized cross-domain benchmarks remain limited"));
    assert.ok(!result.calibratedText.includes("no benchmark exists"));
  });

  // Test 8: Source Tier Ranking Hierarchy
  it("Test 8: Source Tier Ranking — properly orders Tier 1 peer-reviewed ahead of Tier 5/6 blogs", () => {
    const rawSources = [
      { title: "Random Post on Reddit", url: "https://www.reddit.com/r/MachineLearning/comments/123", type: "Web" },
      { title: "Attention Is All You Need", url: "https://arxiv.org/abs/1706.03762", venue: "NeurIPS 2017", type: "Conference" },
      { title: "FlashAttention: Fast and Memory-Efficient Exact Attention", url: "https://arxiv.org/abs/2205.14135", venue: "arXiv:2205.14135", type: "arXiv" },
      { title: "My Tech Blog Post", url: "https://medium.com/@dev/my-thoughts", type: "Blog" },
    ];

    const ranked = rankAndFilterSources(rawSources, "Attention Mechanisms");

    assert.equal(ranked[0]?.tier.startsWith("Tier 1"), true);
    assert.equal(ranked[1]?.tier.startsWith("Tier 2"), true);
    assert.equal(ranked[ranked.length - 1]?.tier.startsWith("Tier 6"), true);
  });

  // Test 9: Quality Gate Scoring
  it("Test 9: Quality Gate Scoring — computes comprehensive score and identifies gate failures", () => {
    const mockLedger: ClaimEvidenceLedgerItem[] = [
      {
        claim_id: "c1",
        claim: "Claim 1",
        claim_type: "empirical",
        importance: "core",
        source_ids: ["s1"],
        source_quality: "Tier 1: Peer-Reviewed Journal / Top Conference",
        source_title: "Paper 1",
        source_url: "https://arxiv.org/abs/1",
        source_type: "Paper",
        publication_year: 2024,
        exact_support: "Support 1",
        confidence: "HIGH",
        verification_status: "VERIFIED",
      },
      {
        claim_id: "c2",
        claim: "Claim 2",
        claim_type: "numerical",
        importance: "core",
        source_ids: ["s2"],
        source_quality: "Tier 2: arXiv Preprint / Official Lab Publication",
        source_title: "Paper 2",
        source_url: "https://arxiv.org/abs/2",
        source_type: "Paper",
        publication_year: 2024,
        exact_support: "Support 2",
        model: "LLaMA-3",
        dataset: "GSM8K",
        confidence: "HIGH",
        verification_status: "VERIFIED",
      },
    ];

    const mockSources: ResearchSource[] = [
      {
        id: "s1",
        title: "Paper 1",
        url: "https://arxiv.org/abs/1",
        authors: ["Author 1"],
        year: 2024,
        yearOrId: "2024",
        type: "Paper",
        tier: "Tier 1: Peer-Reviewed Journal / Top Conference",
        tierRank: 1,
        abstractOrSnippet: "Snippet 1",
        isPrimarySource: true,
      },
      {
        id: "s2",
        title: "Paper 2",
        url: "https://arxiv.org/abs/2",
        authors: ["Author 2"],
        year: 2024,
        yearOrId: "2024",
        type: "Paper",
        tier: "Tier 2: arXiv Preprint / Official Lab Publication",
        tierRank: 2,
        abstractOrSnippet: "Snippet 2",
        isPrimarySource: true,
      },
    ];

    const metrics = evaluateResearchQualityGate({
      ledger: mockLedger,
      sources: mockSources,
      citationAudit: {
        totalCitationsAudited: 2,
        verifiedCount: 2,
        partiallySupportedCount: 0,
        unsupportedCount: 0,
        citationEntailmentRatio: 1.0,
        auditItems: [],
      },
      contradictionsCount: 1,
      uncalibratedTermsCount: 0,
    });

    assert.equal(metrics.passedQualityGate, true);
    assert.equal(metrics.overallScore >= 80, true);
    assert.equal(metrics.verifiedClaimsRatio, 1.0);
    assert.equal(metrics.tier1And2SourcesRatio, 1.0);
  });
});
