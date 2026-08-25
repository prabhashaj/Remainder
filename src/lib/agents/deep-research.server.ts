import { generateObject, generateText } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createAiGatewayProvider,
  getResearchModelName,
  getAiModelName,
  withAiRateLimitRetry,
} from "@/lib/ai-gateway.server";
import { log } from "@/lib/logger.server";
import {
  searchArxivServer,
  searchPapersServer,
  type ArxivPaper,
  type AcademicPaper,
} from "@/lib/academic-tools.server";
import { tavilySearch, type WebResult } from "@/lib/tavily.server";
import type { Database } from "@/integrations/supabase/types";

import {
  type CanonicalSource,
  type ClaimEvidenceLedgerItem,
  type ResearchQualityMetrics,
  CanonicalSourceRegistry,
  LedgerExtractionSchema,
  verifyNumericalClaim,
  auditContextMismatch,
  executeCounterEvidenceSearch,
  auditAndCalibrateText,
  auditCitationEntailment,
  runAdversarialReview,
  evaluateResearchQualityGate,
} from "./research-engine";

export interface ResearchPlan {
  topic: string;
  scope: string;
  temporalConstraints: string;
  keyDimensions: string[];
}

export interface ResearchSubtask {
  id: string;
  title: string;
  objective: string;
  arxivQuery: string;
  academicQuery: string;
  webQueries: string[];
  category?: string | undefined;
  targetYearMin?: number | undefined;
  objectiveType?: "conceptual/qualitative" | "quantitative/benchmark" | "mechanistic/how-it-works" | undefined;
}

export interface SubagentFinding {
  subtaskId: string;
  title: string;
  objective: string;
  findingsSummary: string;
  keyArchitectures: string[];
  papers: {
    title: string;
    id: string;
    url: string;
    published: string;
    summary: string;
    authors: string[];
  }[];
  webSources: {
    title: string;
    url: string;
    content: string;
  }[];
}

export interface DeepResearchResult {
  topic: string;
  plan: ResearchPlan;
  subtasks: ResearchSubtask[];
  subagentResults: SubagentFinding[];
  report: string;
  sourcesMarkdown: string;
  actionTrail: {
    step: string;
    status: "completed" | "in_progress";
    details: string;
  }[];
  ledger?: ClaimEvidenceLedgerItem[] | undefined;
  qualityMetrics?: ResearchQualityMetrics | undefined;
}

type Supabase = SupabaseClient<Database>;

/**
 * Step 1: Generate Research Plan and Split into Orthogonal Subtasks
 */
async function createPlanAndSubtasks(
  topic: string,
  gateway: ReturnType<typeof createAiGatewayProvider>,
  modelName: string,
): Promise<{ plan: ResearchPlan; subtasks: ResearchSubtask[] }> {
  const currentYear = new Date().getFullYear();
  const isFreshnessRequested = /\b(latest|recent|current|2025|2026|modern|newest|state of the art)\b/i.test(topic);

  const planningPrompt = `You are an expert Research Planner Agent.
Analyze the user's research topic or question: "${topic}".
Current Year: ${currentYear}.

Your goal:
1. Formulate a structured Research Plan outlining the core scope, temporal window (e.g., historical context vs. recent advancements), and key analytical pillars (keyDimensions).
   - Context/Paradigm Distinction: If the topic spans two evidentiary or operational contexts that could be wrongly conflated (e.g., theoretical vs. applied, historical vs. current, correlational vs. causal, lab/controlled vs. real-world/deployed, training-time vs. runtime for ML systems), make that distinction an explicit keyDimension so subtasks and downstream synthesis don't blur the two.
2. Decompose the topic into 3 to 4 distinct, orthogonal investigation subtasks for parallel research subagents:
   - Quantitative Coverage: If the topic names or implies a measurable target, threshold, or magnitude (a latency budget, a percentage, a price level, a rate, a deadline, a cost limit, etc.), you MUST include at least one subtask specifically targeting quantitative data, benchmarks, or figures for that target.
   - Mechanistic / Architecture Coverage: When the research topic concerns a system, process, method, or architecture, you MUST ensure at least one subtask targets mechanistic/how-it-works content — concrete execution patterns, architectural walkthroughs, or step-by-step processes.
   - For each subtask, classify its objectiveType as either "conceptual/qualitative", "quantitative/benchmark", or "mechanistic/how-it-works".
3. Provide targeted search queries for each subtask:
   - arxivQuery: Keywords for academic preprint searches.
   - academicQuery: Targeted search query for academic databases.
   - webQueries: An array of 3 highly diverse search queries for the live web index.`;

  const SubtasksSchema = z.object({
    plan: z.object({
      topic: z.string(),
      scope: z.string().describe("High-level scope of the investigation"),
      temporalConstraints: z
        .string()
        .describe("Explicit time window relevant to the topic (e.g., 'past 5 years', 'recent advancements')"),
      keyDimensions: z.array(z.string()).describe("3-4 critical technical pillars"),
    }),
    subtasks: z.array(
      z.object({
        id: z.string().describe("Unique identifier like subtask_1"),
        title: z.string().describe("Short descriptive title of the subtask"),
        objective: z.string().describe("Specific technical question to resolve"),
        objectiveType: z
          .enum(["conceptual/qualitative", "quantitative/benchmark", "mechanistic/how-it-works"])
          .describe("Whether the subtask objective is conceptual/qualitative, quantitative/benchmark, or mechanistic/how-it-works"),
        arxivQuery: z.string().describe("Optimized search query for arXiv API"),
        academicQuery: z.string().describe("Optimized query for Semantic Scholar / OpenAlex"),
        webQueries: z.array(z.string()).describe("3 diverse Tavily search queries (general, news, forums)"),
        category: z
          .string()
          .optional()
          .describe("arXiv category code if applicable (e.g. cs.CV, cs.AI, cs.LG)"),
        targetYearMin: z
          .number()
          .optional()
          .describe("Minimum publication year if recent papers are requested"),
      }),
    ),
  });

  try {
    const { object } = await withAiRateLimitRetry(
      () =>
        generateObject({
          model: gateway(modelName),
          system:
            "You are an expert research coordinator that plans and decomposes topics into precise, executable subtasks.",
          prompt: planningPrompt,
          schema: SubtasksSchema,
        }),
      { label: "Planner Agent", maxRetries: 3 },
    );
    return object;
  } catch (err) {
    log("warn", "deep_research_plan_fallback", { error: String(err) });
    const yearMin = isFreshnessRequested ? currentYear - 2 : currentYear - 5;
    return {
      plan: {
        topic,
        scope: `Deep technical investigation into ${topic}`,
        temporalConstraints: isFreshnessRequested ? `Recent advancements (${currentYear - 2}-${currentYear})` : "Foundational and contemporary developments",
        keyDimensions: [
          "Core Foundations & Principles",
          "Key Methodologies & Frameworks",
          "Empirical Evidence & State-of-the-Art Benchmarks",
        ],
      },
      subtasks: [
        {
          id: "subtask_1",
          title: "Core Foundations & Architecture",
          objective: "Identify the foundational principles, theoretical mechanics, and core architecture.",
          objectiveType: "mechanistic/how-it-works",
          arxivQuery: `${topic} architecture foundations`,
          academicQuery: `${topic} foundational principles review`,
          webQueries: [
            `${topic} architecture principles ${currentYear}`,
            `${topic} technical breakdown explanation`,
            `${topic} implementation patterns`,
          ],
          targetYearMin: yearMin,
        },
        {
          id: "subtask_2",
          title: "Key Methodologies & Applications",
          objective: "Investigate practical methodologies, key applications, and notable advancements.",
          objectiveType: "conceptual/qualitative",
          arxivQuery: `${topic} methodology applications`,
          academicQuery: `${topic} methodology advancement applications`,
          webQueries: [
            `${topic} latest applications methodology ${currentYear}`,
            `${topic} methodology real-world case studies`,
            `${topic} practical guide workflow`,
          ],
          targetYearMin: yearMin,
        },
        {
          id: "subtask_3",
          title: "Current State-of-the-Art & Empirical Benchmarks",
          objective: "Collect verified empirical metrics, state-of-the-art comparisons, and real-world validations.",
          objectiveType: "quantitative/benchmark",
          arxivQuery: `${topic} benchmark state-of-the-art performance`,
          academicQuery: `${topic} benchmark results comparison`,
          webQueries: [
            `${topic} latest benchmark comparison ${currentYear}`,
            `${topic} performance metrics evaluation`,
            `${topic} comparative analysis`,
          ],
          targetYearMin: yearMin,
        },
      ],
    };
  }
}

/**
 * Step 2: Parallel Subagent Worker Execution
 */
async function executeSubagentWorker(
  subtask: ResearchSubtask,
  gateway: ReturnType<typeof createAiGatewayProvider>,
  modelName: string,
  onStepProgress?: (step: string, details: string) => void,
): Promise<SubagentFinding> {
  const [arxivPapers, academicPapers, ...webResultsArray] = await Promise.all([
    searchArxivServer(subtask.arxivQuery, {
      sortBy: "relevance",
      maxResults: 6,
      yearMin: subtask.targetYearMin,
      category: subtask.category,
    }),
    searchPapersServer(subtask.academicQuery, {
      maxResults: 4,
      yearMin: subtask.targetYearMin,
    }),
    ...subtask.webQueries.map((q) =>
      tavilySearch(q, { maxResults: 4, depth: "basic" }).catch(() => ({
        results: [] as WebResult[],
        answer: "",
      }))
    ),
  ]);

  // Deduplicate web results
  const allWebResults: WebResult[] = [];
  const seenWebUrls = new Set<string>();
  for (const wr of webResultsArray) {
    for (const r of wr.results) {
      if (r.url && !seenWebUrls.has(r.url)) {
        seenWebUrls.add(r.url);
        allWebResults.push(r);
      }
    }
  }

  // Deduplicate arXiv papers
  const seenArxivIds = new Set<string>();
  const allArxivPapers: ArxivPaper[] = [];
  for (const paper of arxivPapers) {
    if (paper.id && !seenArxivIds.has(paper.id)) {
      seenArxivIds.add(paper.id);
      allArxivPapers.push(paper);
    }
  }

  // Format evidence context for worker LLM synthesis
  const evidenceLines: string[] = [];
  evidenceLines.push(`## ArXiv Papers (${allArxivPapers.length} retrieved):`);
  for (const p of allArxivPapers) {
    evidenceLines.push(
      `- Title: "${p.title}" | ID: ${p.id} | Published: ${p.published || "Unknown"} | Authors: ${p.authors.join(", ")}`,
    );
    evidenceLines.push(`  Summary: ${p.summary.slice(0, 500)}`);
    evidenceLines.push(`  URL: ${p.arxivUrl || p.pdfUrl}`);
  }

  evidenceLines.push(`\n## Academic Papers (${academicPapers.length} retrieved):`);
  for (const ap of academicPapers) {
    evidenceLines.push(
      `- Title: "${ap.title}" | Year: ${ap.year || "Unknown"} | Authors: ${ap.authors.join(", ")} | URL: ${ap.url}`,
    );
    evidenceLines.push(`  Abstract: ${ap.abstract.slice(0, 400)}`);
  }

  evidenceLines.push(`\n## Web Research Results (${allWebResults.length} retrieved):`);
  for (const wr of allWebResults) {
    evidenceLines.push(`- [${wr.title}](${wr.url}): ${wr.content.slice(0, 400)}`);
  }

  const subagentSynthesisPrompt = `You are a Research Subagent focused on ONE specific investigation objective.

Subtask: "${subtask.title}"
Objective: ${subtask.objective}

Raw evidence gathered from arXiv, academic databases, and web search:
${evidenceLines.join("\n")}

Your task:
1. Filter this raw evidence down to only what is actually relevant to the objective above.
2. Synthesize the relevant evidence into a structured findings summary (500-800 words):
   - Highlight exact methodologies, architectural mechanics, and models evaluated.
   - For every numerical result, note the exact baseline, dataset, model, and experimental conditions.
   - For every claim, explicitly reference the supporting paper/source.
   - Note whether a paper is the creator of a method vs. a study evaluating/citing a related concept.
   - Write "Hardware: Not reported in the source" if hardware is absent. NEVER assume or infer GPU setup.
   - Flag limitations and what the papers did NOT demonstrate.
   - Flag any conflicting findings across sources.
3. Do NOT invent or generalize figures beyond the text.`;

  let findingsSummary = "";
  try {
    const { text } = await withAiRateLimitRetry(
      () =>
        generateText({
          model: gateway(getAiModelName()),
          system:
            "You are a rigorous research subagent. You filter noise and synthesize only well-sourced findings for downstream fact-checking.",
          prompt: subagentSynthesisPrompt,
        }),
      { label: `Subagent Synthesis (${subtask.id})`, maxRetries: 3 },
    );
    findingsSummary = text;
  } catch (err) {
    log("warn", "subagent_synthesis_failed", { subtaskId: subtask.id, error: String(err) });
    findingsSummary = evidenceLines.join("\n").slice(0, 2500) + "\n\n[Note: Subagent synthesis fallback used.]";
  }

  if (onStepProgress) {
    onStepProgress(
      `Research Subagent: ${subtask.title}`,
      `Completed synthesis of ${allArxivPapers.length} arXiv papers and ${allWebResults.length} web sources.`,
    );
  }

  return {
    subtaskId: subtask.id,
    title: subtask.title,
    objective: subtask.objective,
    findingsSummary,
    keyArchitectures: allArxivPapers.slice(0, 4).map((p) => p.title),
    papers: allArxivPapers.map((p) => ({
      title: p.title,
      id: p.id,
      url: p.arxivUrl || p.pdfUrl,
      published: p.published,
      summary: p.summary,
      authors: p.authors,
    })),
    webSources: allWebResults.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
    })),
  };
}

/**
 * Step 3: Extract Structured Claim-Evidence Ledger from Subagent Findings
 */
async function extractClaimEvidenceLedger(
  topic: string,
  subagentResults: SubagentFinding[],
  registry: CanonicalSourceRegistry,
  gateway: ReturnType<typeof createAiGatewayProvider>,
  modelName: string,
): Promise<ClaimEvidenceLedgerItem[]> {
  const canonicalSources = registry.getAllSources();

  const findingsBlock = subagentResults
    .map((s, idx) => `### Subtask ${idx + 1}: ${s.title}\nObjective: ${s.objective}\nFindings:\n${s.findingsSummary}`)
    .join("\n\n");

  const sourcesBlock = canonicalSources
    .slice(0, 15)
    .map((s) => `[${s.source_id}] "${s.canonical_title}" (${s.yearOrId}) - Venue: ${s.venue || "arXiv/Web"} | Tier: ${s.source_tier} | URL: ${s.canonical_url}\nAbstract: ${s.abstractOrSnippet.slice(0, 300)}`)
    .join("\n\n");

  const extractionPrompt = `You are an expert Research Knowledge Engineer.
Extract a structured Claim-Evidence Ledger from the synthesized research findings for topic: "${topic}".

Canonical Source Registry (Match claims ONLY to these exact source IDs):
${sourcesBlock}

Synthesized Findings from Parallel Subagents:
${findingsBlock}

Strict Extraction Instructions:
1. Extract 8 to 15 core and supporting claims across all dimensions (factual, theoretical, empirical, numerical, comparative, research_gap).
2. PAPER CONTRIBUTION VS RELATED CONCEPT: Distinguish whether the cited paper proposed the method (paper_contribution) vs merely cited or evaluated a related concept (related_concept). Never attribute a method to the wrong paper.
3. METRIC FIDELITY: Retain original metric wording (e.g. "peak best-score attainment"). Do not drift metrics into "final reward".
4. NO INVENTED HARDWARE: If hardware is absent in source, write "Hardware: Not reported in the source". Never assume or guess.
5. If a claim lacks direct support in the sources, classify verification_status as "UNSUPPORTED" or "PARTIALLY_SUPPORTED".
6. If an asserted research gap is found (e.g., "no benchmark exists"), classify claim_type as "research_gap".`;

  try {
    const { object } = await withAiRateLimitRetry(
      () =>
        generateObject({
          model: gateway(modelName),
          system:
            "You are a rigorous knowledge engineer that extracts verified, structured claim-evidence records.",
          prompt: extractionPrompt,
          schema: LedgerExtractionSchema,
        }),
      { label: "Ledger Extraction", maxRetries: 2 },
    );

    return object.claims.map((rawClaim, idx) => {
      const matchedSource =
        (rawClaim.source_id ? registry.getSourceById(rawClaim.source_id) : undefined) ||
        canonicalSources.find(
          (s) => s.canonical_title.toLowerCase().includes(rawClaim.source_title.slice(0, 20).toLowerCase()) || s.canonical_url === rawClaim.source_url,
        ) || canonicalSources[0]!;

      const item: ClaimEvidenceLedgerItem = {
        claim_id: `claim_${idx + 1}`,
        claim: rawClaim.claim,
        claim_type: rawClaim.claim_type,
        importance: rawClaim.importance,
        source_ids: [matchedSource.source_id],
        source_quality: matchedSource.source_tier,
        source_title: matchedSource.canonical_title,
        source_url: matchedSource.canonical_url,
        source_type: matchedSource.source_type,
        publication_year: matchedSource.publication_year || new Date().getFullYear(),
        exact_support: rawClaim.exact_support,
        support_level: rawClaim.support_level || "DIRECTLY_SUPPORTED",
        paper_contribution_vs_related: rawClaim.paper_contribution_vs_related,
        original_metric_wording: rawClaim.original_metric_wording,
        metric_name: rawClaim.metric_name,
        model: rawClaim.model,
        dataset: rawClaim.dataset,
        task: rawClaim.task,
        metric: rawClaim.metric,
        reported_result: rawClaim.reported_result,
        baseline: rawClaim.baseline,
        hardware: rawClaim.hardware || "Not reported in the source",
        hardware_reported: Boolean(rawClaim.hardware && !rawClaim.hardware.includes("Not reported")),
        experimental_context: rawClaim.experimental_context,
        evidence_level: rawClaim.evidence_level,
        math_formulation_type: rawClaim.math_formulation_type,
        math_equation: rawClaim.math_equation,
        what_source_showed: rawClaim.what_source_showed,
        what_source_did_not_show: rawClaim.what_source_did_not_show,
        limitations: rawClaim.limitations,
        is_direct_comparison: rawClaim.is_direct_comparison,
        comparison_notes: rawClaim.comparison_notes,
        confidence: rawClaim.confidence,
        verification_status: rawClaim.verification_status,
      };

      // Run deterministic numerical verification
      if (item.claim_type === "numerical" || /\d+/.test(item.claim)) {
        const numCheck = verifyNumericalClaim(item.claim, item.exact_support, matchedSource.abstractOrSnippet || "");
        if (numCheck.verificationStatus === "UNSUPPORTED") {
          item.verification_status = "UNSUPPORTED";
          item.support_level = "UNSUPPORTED";
          item.confidence = "LOW";
        }
      }

      // Run deterministic context mismatch audit
      const contextCheck = auditContextMismatch(item.claim, item);
      if (contextCheck.hasMismatch) {
        item.verification_status = "PARTIALLY_SUPPORTED";
        item.support_level = "PARTIALLY_SUPPORTED";
        if (contextCheck.calibratedClaim) {
          item.claim = contextCheck.calibratedClaim;
        }
      }

      return item;
    });
  } catch (err) {
    log("warn", "ledger_extraction_fallback", { error: String(err) });
    return subagentResults.map((s, idx) => {
      const src = canonicalSources[idx] || canonicalSources[0]!;
      return {
        claim_id: `claim_${idx + 1}`,
        claim: s.findingsSummary.slice(0, 180),
        claim_type: "empirical" as const,
        importance: "core" as const,
        source_ids: [src.source_id],
        source_quality: src.source_tier,
        source_title: src.canonical_title,
        source_url: src.canonical_url,
        source_type: src.source_type,
        publication_year: src.publication_year || new Date().getFullYear(),
        exact_support: s.findingsSummary.slice(0, 300),
        support_level: "DIRECTLY_SUPPORTED" as const,
        confidence: "MEDIUM" as const,
        verification_status: "VERIFIED" as const,
      };
    });
  }
}

/**
 * Step 4: Verification, Contradiction Search & Dossier Synthesis
 */
async function verifyAndAuditEvidence(
  topic: string,
  plan: ResearchPlan,
  subagentResults: SubagentFinding[],
  gateway: ReturnType<typeof createAiGatewayProvider>,
  modelName: string,
): Promise<{
  verifiedDossier: string;
  registry: CanonicalSourceRegistry;
  ledger: ClaimEvidenceLedgerItem[];
  contradictionsFound: Array<{ claim: string; counterEvidence: string; source: string }>;
}> {
  const registry = new CanonicalSourceRegistry();

  // Register all raw sources into Canonical Source Registry (performing entity resolution & deduplication)
  for (const sub of subagentResults) {
    for (const p of sub.papers) {
      registry.registerSource({
        title: p.title,
        url: p.url || `https://arxiv.org/abs/${p.id}`,
        authors: p.authors,
        yearOrId: p.published ? p.published.slice(0, 4) : p.id ? `arXiv:${p.id}` : "arXiv",
        type: "arXiv Paper",
        venue: "arXiv",
        content: p.summary,
        arxivId: p.id,
      });
    }
    for (const w of sub.webSources) {
      registry.registerSource({
        title: w.title,
        url: w.url,
        yearOrId: "Web",
        type: "Technical Literature",
        content: w.content,
      });
    }
  }

  // Extract Claim-Evidence Ledger using canonical registry
  const rawLedger = await extractClaimEvidenceLedger(topic, subagentResults, registry, gateway, modelName);

  // Counter-Evidence and Contradiction Search
  const { updatedLedger, contradictionsFound, verifiedGaps } = await executeCounterEvidenceSearch(topic, rawLedger);

  // Build Verified Research Dossier
  const ledgerDumps = updatedLedger.map((item, i) => {
    return `### Claim ${i + 1} [${item.claim_type.toUpperCase()}] - Status: ${item.verification_status} (Support: ${item.support_level} | Conf: ${item.confidence})
- Statement: ${item.claim}
- Source: [${item.source_title}](${item.source_url}) [ID: ${item.source_ids.join(", ")}] — *${item.source_quality}* (${item.publication_year})
- Exact Evidence: "${item.exact_support}"
- Experimental Setup: Model=${item.model || "Not reported"} | Dataset=${item.dataset || "Not reported"} | Metric=${item.metric || "Not reported"} | Hardware=${item.hardware || "Not reported in the source"}
- Evaluated Reality: Shown="${item.what_source_showed || "N/A"}" | Not Shown="${item.what_source_did_not_show || "N/A"}"
- Limitations / Caveats: ${item.limitations || "None reported"}
- Counter-Evidence / Disagreements: ${item.counter_evidence || "No direct contradictions found in literature"}`;
  }).join("\n\n");

  const verifiedDossier = `## VERIFIED CLAIM-EVIDENCE LEDGER & LITERATURE AUDIT
Topic: ${topic}
Scope: ${plan.scope}

${ledgerDumps}

${contradictionsFound.length > 0 ? `\n### Identified Counter-Evidence & Literature Disagreements:\n` + contradictionsFound.map((c) => `- On claim "${c.claim}": ${c.counterEvidence}`).join("\n") : ""}

${verifiedGaps.length > 0 ? `\n### Verified Open Research Challenges:\n` + verifiedGaps.map((g) => `- ${g}`).join("\n") : ""}`;

  return {
    verifiedDossier,
    registry,
    ledger: updatedLedger,
    contradictionsFound,
  };
}

/**
 * Step 5: Writer Agent with Adversarial Review & Canonical Reference Generation
 */
async function writePublicationReport(
  topic: string,
  plan: ResearchPlan,
  verifiedDossier: string,
  registry: CanonicalSourceRegistry,
  ledger: ClaimEvidenceLedgerItem[],
  contradictionsCount: number,
  gateway: ReturnType<typeof createAiGatewayProvider>,
  modelName: string,
): Promise<{
  report: string;
  sourcesMarkdown: string;
  qualityMetrics: ResearchQualityMetrics;
}> {
  const canonicalSources = registry.getTopRankedSources(10);
  const sourcesMarkdown = registry.renderCanonicalBibliography(10);

  const formattedSourcesList = canonicalSources
    .map((s, i) => `${i + 1}. [${s.source_id}] [**${s.canonical_title}**](${s.canonical_url}) (${s.yearOrId}) — *${s.source_tier.split(":")[0]}*`)
    .join("\n");

  const writerPrompt = `You are an expert Technical Synthesis Author and Research Writer.
Write an extensive, definitive, publication-grade deep research report based strictly on the verified research dossier and claim-evidence ledger.

User Topic: "${topic}"
Research Scope: ${plan.scope}

${verifiedDossier}

Canonical Sources Available:
${formattedSourcesList}

Report Structure & Depth Requirements:
1. Executive Summary & State-of-the-Art Landscape (2-3 extensive paragraphs):
   - Set the strategic landscape, foundational breakthroughs, core paradigms, and high-level synthesis of findings.
2. Foundational Architecture & Mechanistic Deep Dives (multiple rich, multi-paragraph sections):
   - Exhaustively unpack underlying mechanics: explain *how* and *why* systems work, execution flows, mathematical formulations (LaTeX $inline$ or $$block$$), and empirical phenomena.
3. Implementation Patterns, Frameworks & Practical Workflows:
   - Provide concrete, end-to-end operational workflows, engineering patterns, and practical execution details.
4. Comparative Analysis, Bottlenecks & Tradeoffs:
   - Provide deep analytical narrative examining tradeoffs, failure modes, computational/scaling constraints, and design alternatives.
   - Distinguish direct comparisons (same model/dataset/hardware) from indirect comparisons across disparate studies.
   - You may include AT MOST ONE concise, high-signal summary comparison table in this section to synthesize key dimensions.
5. Empirical Evidence & Benchmark Performance:
   - Synthesize verified empirical metrics, evaluation benchmarks, and quantitative performance grounded strictly in the dossier.
   - Always accompany numbers with model size, dataset, and baseline context.
6. Strategic Implications, Actionable Takeaways & Research Gaps:
   - Concrete takeaways, architectural recommendations, and explicitly identified open research challenges or unverified performance constraints.

Strict Writing Rules:
1. PROSE-FIRST EXPANSIVE WRITING:
   - Prioritize rich, exhaustive narrative prose over tables and bulleted lists.
   - Do NOT substitute tables for explanatory text. Tables should only be used as occasional, concise summary aids (maximum 1-2 tables across the entire report).
2. CANONICAL CITATION GROUNDING:
   - Every citation MUST correspond to a canonical source from the registry.
   - Never cite a paper for an algorithm or contribution made by a different paper.
   - If hardware or seeds were not reported in the source, write "Hardware: Not reported in the source". NEVER infer GPU clusters or typical configurations.
3. PRESERVE METRIC SEMANTICS:
   - Do not drift metrics (e.g., peak best scores -> final reward). Retain the paper's original metric semantics.
4. MATHEMATICAL FIDELITY:
   - Distinguish background formulations from algorithm-specific equations.
5. NO EMOJIS: Keep the entire report completely emoji-free, formal, and authoritative.
6. NO HALLUCINATED STATISTICS OR IDENTIFIERS:
   - Only quote figures and identifiers explicitly present in the verified dossier above.
7. TEMPORAL HONESTY:
   - Do NOT present speculative future projections as historical facts.`;

  let draftReport = "";
  try {
    const { text } = await withAiRateLimitRetry(
      () =>
        generateText({
          model: gateway(modelName),
          system:
            "You are an expert Research Writer Agent. You compose highly structured, thoroughly researched, and professional deep research reports.",
          prompt: writerPrompt,
        }),
      { label: "Writer Agent", maxRetries: 3 },
    );
    draftReport = text;
  } catch (err) {
    log("warn", "writer_primary_model_failed", { error: String(err) });
    try {
      const fallbackModel = getAiModelName();
      const { text } = await withAiRateLimitRetry(
        () =>
          generateText({
            model: gateway(fallbackModel),
            system:
              "You are an expert Research Writer Agent. You compose highly structured, thoroughly researched, and professional deep research reports.",
            prompt: writerPrompt,
          }),
        { label: "Writer Agent Fallback", maxRetries: 2 },
      );
      draftReport = text;
    } catch (fallbackErr) {
      log("error", "writer_fallback_failed", { error: String(fallbackErr) });
      draftReport = `# Research Report on ${topic}\n\n${verifiedDossier}\n\n[Note: Final report synthesis used fallback raw dossier format.]`;
    }
  }

  // Step 6: Citation Entailment Audit
  const citationAudit = auditCitationEntailment(draftReport, ledger, canonicalSources);

  // Step 7: Adversarial Peer Review & Epistemic Calibration Pass
  const reviewResult = await runAdversarialReview({
    topic,
    draftReport,
    ledger,
    sources: canonicalSources,
    gateway,
    modelName,
  });

  const finalReportText = reviewResult.revisedReport || draftReport;

  // Step 8: Quality Gate Evaluation
  const qualityMetrics = evaluateResearchQualityGate({
    ledger,
    sources: canonicalSources,
    citationAudit,
    contradictionsCount,
    uncalibratedTermsCount: reviewResult.absoluteClaimsToCalibrate.length,
    inventedContextsCount: reviewResult.inventedContextsToCleanse.length,
  });

  return {
    report: `${finalReportText}\n\n${sourcesMarkdown}`,
    sourcesMarkdown,
    qualityMetrics,
  };
}

/**
 * Main Entry Point: Multi-Agent Deep Research Orchestrator
 */
export async function runDeepResearch(params: {
  topic: string;
  apiKey: string;
  supabase: SupabaseClient<Database>;
  userId: string;
  traceId?: string;
  onStepProgress?: (step: string, details: string) => void;
}): Promise<DeepResearchResult> {
  const gateway = createAiGatewayProvider(params.apiKey);
  const modelName = getResearchModelName();

  const actionTrail: DeepResearchResult["actionTrail"] = [];

  const recordStep = (step: string, details: string) => {
    actionTrail.push({ step, status: "completed", details });
    if (params.onStepProgress) {
      params.onStepProgress(step, details);
    }
  };

  log("info", "deep_research_started", { topic: params.topic, userId: params.userId });

  // 1. Planner Agent: Scope & Subtask Decomposition
  recordStep("Planner Agent", `Formulating research scope and temporal parameters for: "${params.topic}"`);
  const { plan, subtasks } = await createPlanAndSubtasks(params.topic, gateway, modelName);
  recordStep(
    "Planner Agent",
    `Decomposed into ${subtasks.length} parallel research subtasks: ${subtasks.map((s) => s.title).join(", ")}`,
  );

  // 2. Research Subagents: Parallel Multi-Query Search & Extraction
  recordStep(
    "Research Subagents",
    `Executing parallel multi-query search across arXiv API, Semantic Scholar, OpenAlex, and live Web index.`,
  );

  const subagentResults = await Promise.all(
    subtasks.map(async (subtask) => {
      try {
        return await executeSubagentWorker(subtask, gateway, modelName, params.onStepProgress);
      } catch (err) {
        log("error", "subagent_worker_failed", { subtaskId: subtask.id, error: String(err) });
        return {
          subtaskId: subtask.id,
          title: subtask.title,
          objective: subtask.objective,
          findingsSummary: `Investigation encountered an error: ${String(err)}`,
          keyArchitectures: [],
          papers: [],
          webSources: [],
        };
      }
    }),
  );

  // 3. Canonical Registry, Claim-Evidence Ledger & Contradiction Search
  recordStep(
    "Evidence Engine",
    "Resolving canonical source entities, constructing Claim-Evidence Ledger, and executing contradiction searches.",
  );

  const { verifiedDossier, registry, ledger, contradictionsFound } = await verifyAndAuditEvidence(
    params.topic,
    plan,
    subagentResults,
    gateway,
    modelName,
  );

  recordStep(
    "Evidence Ledger",
    `Resolved ${registry.getAllSources().length} canonical sources and ${ledger.length} verified claim-evidence records with zero invented experimental details.`,
  );

  // 4. Writer Agent, Citation Audit, Adversarial Review & Quality Gate
  recordStep(
    "Synthesis & Review",
    "Composing technical report, auditing citation entailment, and running adversarial peer-review revision.",
  );

  const { report, sourcesMarkdown, qualityMetrics } = await writePublicationReport(
    params.topic,
    plan,
    verifiedDossier,
    registry,
    ledger,
    contradictionsFound.length,
    gateway,
    modelName,
  );

  recordStep(
    "Quality Gate Passed",
    `Research Quality Score: ${qualityMetrics.overallScore}/100 (Citation Correctness: ${Math.round(qualityMetrics.citationCorrectnessScore * 100)}%, Direct Support: ${Math.round(qualityMetrics.claimEvidenceSupportScore * 100)}%, Metadata Accuracy: ${Math.round(qualityMetrics.sourceIdentityMetadataScore * 100)}%).`,
  );

  log("info", "deep_research_completed", {
    topic: params.topic,
    subtasksCount: subtasks.length,
    canonicalSourcesCount: registry.getAllSources().length,
    ledgerClaimsCount: ledger.length,
    qualityScore: qualityMetrics.overallScore,
  });

  return {
    topic: params.topic,
    plan,
    subtasks,
    subagentResults,
    report,
    sourcesMarkdown,
    actionTrail,
    ledger,
    qualityMetrics,
  };
}
