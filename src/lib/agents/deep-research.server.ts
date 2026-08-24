import { generateObject, generateText } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAiGatewayProvider, getResearchModelName } from "@/lib/ai-gateway.server";
import { log } from "@/lib/logger.server";
import {
  searchArxivServer,
  searchPapersServer,
  type ArxivPaper,
  type AcademicPaper,
} from "@/lib/academic-tools.server";
import { tavilySearch, type WebResult } from "@/lib/tavily.server";
import type { Database } from "@/integrations/supabase/types";

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
  webQuery: string;
  category?: string | undefined;
  targetYearMin?: number | undefined;
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
}

type Supabase = SupabaseClient<Database>;

/**
 * Step 1 & 2: Generate Research Plan and Split into Orthogonal Subtasks
 */
async function createPlanAndSubtasks(
  topic: string,
  gateway: ReturnType<typeof createAiGatewayProvider>,
  modelName: string,
): Promise<{ plan: ResearchPlan; subtasks: ResearchSubtask[] }> {
  const currentYear = new Date().getFullYear();

  const planningPrompt = `You are a Principal Research Coordinator at Remispace.
Analyze the user's research topic or question: "${topic}".
Current Year: ${currentYear}.

Your goal:
1. Formulate a structured Research Plan outlining the core scope, temporal window (e.g. recent ${currentYear - 2}–${currentYear} developments), and key analytical pillars.
2. Decompose the topic into 3 to 4 distinct, orthogonal investigation subtasks for parallel research subagents.
3. Provide targeted search queries for each subtask:
   - arxivQuery: Pure search keywords (e.g. 'gold price drivers macroeconomics inflation' or 'vision transformer self attention'). NEVER include boolean operators (AND/OR), quotes, or submittedDate filters.
   - academicQuery: Targeted search query for academic databases and preprint repositories.
   - webQuery: Targeted search query for the live web index, recent market reports, and empirical sources.`;

  const SubtasksSchema = z.object({
    plan: z.object({
      topic: z.string(),
      scope: z.string().describe("High-level scope of the investigation"),
      temporalConstraints: z
        .string()
        .describe("Explicit time window (e.g. 2024–2026 for latest upgrades)"),
      keyDimensions: z.array(z.string()).describe("3-4 critical technical pillars"),
    }),
    subtasks: z.array(
      z.object({
        id: z.string().describe("Unique identifier like subtask_1"),
        title: z.string().describe("Short descriptive title of the subtask"),
        objective: z.string().describe("Specific technical question to resolve"),
        arxivQuery: z.string().describe("Optimized search query for arXiv API"),
        academicQuery: z.string().describe("Optimized query for Semantic Scholar / OpenAlex"),
        webQuery: z.string().describe("Optimized Google/Tavily search query"),
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
    const { object } = await generateObject({
      model: gateway(modelName),
      system:
        "You are an expert research coordinator that plans and decomposes technical literature reviews into precise, executable subtasks.",
      prompt: planningPrompt,
      schema: SubtasksSchema,
    });
    return object;
  } catch (err) {
    log("warn", "deep_research_plan_fallback", { error: String(err) });
    // Fallback subtask generation
    return {
      plan: {
        topic,
        scope: `Deep technical investigation into ${topic}`,
        temporalConstraints: `${currentYear - 2}–${currentYear}`,
        keyDimensions: [
          "Architectural Foundations",
          "Efficiency & Attention Scaling",
          "Empirical SOTA Benchmarks",
        ],
      },
      subtasks: [
        {
          id: "subtask_1",
          title: "Core Architectural Upgrades & Mechanisms",
          objective: "Identify structural modifications, attention variants, and layer designs.",
          arxivQuery: `${topic} architecture transformer attention`,
          academicQuery: `${topic} architecture advancements`,
          webQuery: `${topic} latest architecture breakthroughs ${currentYear}`,
          targetYearMin: currentYear - 2,
        },
        {
          id: "subtask_2",
          title: "Efficiency, Complexity & Scaling",
          objective: "Investigate linear attention, sparsity, token pruning, and memory scaling.",
          arxivQuery: `${topic} efficiency scaling linear attention`,
          academicQuery: `${topic} linear complexity efficiency`,
          webQuery: `${topic} efficient scaling linear attention ${currentYear}`,
          targetYearMin: currentYear - 2,
        },
        {
          id: "subtask_3",
          title: "State-of-the-Art Benchmarks & Practical Validations",
          objective: "Collect verified empirical metrics, ImageNet/COCO benchmarks, and comparative gains.",
          arxivQuery: `${topic} benchmark SOTA performance`,
          academicQuery: `${topic} benchmark results SOTA`,
          webQuery: `${topic} benchmark comparison SOTA ${currentYear}`,
          targetYearMin: currentYear - 2,
        },
      ],
    };
  }
}

/**
 * Step 3: Parallel Subagent Worker Execution
 */
async function executeSubagentWorker(
  subtask: ResearchSubtask,
  gateway: ReturnType<typeof createAiGatewayProvider>,
  modelName: string,
): Promise<SubagentFinding> {
  const [arxivPapers, academicPapers, webResults] = await Promise.all([
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
    tavilySearch(subtask.webQuery, { maxResults: 5, depth: "basic" }).catch(() => ({
      results: [] as WebResult[],
      answer: "",
    })),
  ]);

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
    evidenceLines.push(`  Summary: ${p.summary.slice(0, 400)}...`);
    evidenceLines.push(`  URL: ${p.arxivUrl || p.pdfUrl}`);
  }

  evidenceLines.push(`\n## Academic Papers (${academicPapers.length} retrieved):`);
  for (const ap of academicPapers) {
    evidenceLines.push(
      `- Title: "${ap.title}" | Year: ${ap.year || "Unknown"} | Authors: ${ap.authors.join(", ")} | URL: ${ap.url}`,
    );
    evidenceLines.push(`  Abstract: ${ap.abstract.slice(0, 300)}...`);
  }

  evidenceLines.push(`\n## Web Research Results (${webResults.results.length} retrieved):`);
  for (const wr of webResults.results) {
    evidenceLines.push(`- [${wr.title}](${wr.url}): ${wr.content.slice(0, 350)}...`);
  }

  const extractedArchitectures = allArxivPapers.slice(0, 4).map((p) => p.title);
  const paperBulletPoints = allArxivPapers
    .slice(0, 5)
    .map(
      (p) =>
        `• [${p.title}](${p.arxivUrl || p.pdfUrl}) (${p.published ? p.published.slice(0, 10) : "Recent"})\n  Authors: ${p.authors.slice(0, 3).join(", ")}\n  Abstract: ${p.summary.slice(0, 300)}...`,
    )
    .join("\n\n");

  const academicBulletPoints = academicPapers
    .slice(0, 3)
    .map((ap) => `• [${ap.title}](${ap.url}) (${ap.year || "Recent"})\n  Abstract: ${ap.abstract.slice(0, 250)}...`)
    .join("\n\n");

  const webBulletPoints = webResults.results
    .slice(0, 3)
    .map((w) => `• [${w.title}](${w.url}): ${w.content.slice(0, 250)}...`)
    .join("\n\n");

  const findingsSummary = [
    `Specialized Subagent Analysis for "${subtask.title}" (${subtask.objective}):`,
    `Discovered ${allArxivPapers.length} arXiv papers, ${academicPapers.length} academic preprints, and ${webResults.results.length} web benchmark sources.`,
    paperBulletPoints ? `Primary arXiv Preprints:\n${paperBulletPoints}` : "",
    academicBulletPoints ? `Academic Literature:\n${academicBulletPoints}` : "",
    webBulletPoints ? `Web & Technical Metrics:\n${webBulletPoints}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    subtaskId: subtask.id,
    title: subtask.title,
    objective: subtask.objective,
    findingsSummary,
    keyArchitectures: extractedArchitectures,
    papers: allArxivPapers.map((p) => ({
      title: p.title,
      id: p.id,
      url: p.arxivUrl || p.pdfUrl,
      published: p.published,
      summary: p.summary,
      authors: p.authors,
    })),
    webSources: webResults.results.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
    })),
  };
}

function filterRelevantSources(
  sources: { title: string; url: string; yearOrId: string; type: string }[],
  topic: string,
): { title: string; url: string; yearOrId: string; type: string }[] {
  const topicLower = topic.toLowerCase();

  const stopWords = new Set([
    "about", "what", "when", "which", "where", "tell", "explain", "happens",
    "next", "months", "years", "research", "recent", "study", "analysis", "few",
    "with", "from", "into", "over", "under", "after", "before", "their", "this", "that",
  ]);
  const topicTokens = topicLower
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((tok) => tok.length >= 3 && !stopWords.has(tok));

  const isCommodityOrFinance =
    topicLower.includes("gold") ||
    topicLower.includes("silver") ||
    topicLower.includes("oil") ||
    topicLower.includes("commodity") ||
    topicLower.includes("price") ||
    topicLower.includes("inflation") ||
    topicLower.includes("macroeconomic") ||
    topicLower.includes("stock") ||
    topicLower.includes("market") ||
    topicLower.includes("economy");

  const isAiOrTech =
    topicLower.includes("transformer") ||
    topicLower.includes("llm") ||
    topicLower.includes("vision") ||
    topicLower.includes("neural") ||
    topicLower.includes("diffusion") ||
    topicLower.includes("agent") ||
    topicLower.includes("attention");

  return sources.filter((src) => {
    const title = src.title.toLowerCase();

    // 1. Direct topic token match
    const hasDirectMatch = topicTokens.some((tok) => title.includes(tok));

    // 2. Reject cross-domain noise for finance/commodity topics
    if (isCommodityOrFinance) {
      const isNoiseForFinance =
        title.includes("chatbot") ||
        title.includes("customer service") ||
        title.includes("language model") ||
        title.includes("large causal model") ||
        title.includes("speech synthesis") ||
        title.includes("segmentation") ||
        title.includes("medical") ||
        title.includes("cancer") ||
        title.includes("surgical") ||
        title.includes("crypto") ||
        title.includes("bitcoin") ||
        title.includes("blockchain") ||
        title.includes("ethereum") ||
        title.includes("nft") ||
        title.includes("defi") ||
        title.includes("probing");

      if (isNoiseForFinance) return false;

      const hasFinanceContext =
        hasDirectMatch ||
        title.includes("gold") ||
        title.includes("precious metal") ||
        title.includes("commodity") ||
        title.includes("inflation") ||
        title.includes("interest rate") ||
        title.includes("monetary") ||
        title.includes("central bank") ||
        title.includes("reserve") ||
        title.includes("dollar") ||
        title.includes("dxy") ||
        title.includes("forecast") ||
        title.includes("volatility") ||
        title.includes("econometric") ||
        title.includes("garch");

      return hasFinanceContext;
    }

    if (isAiOrTech) {
      return hasDirectMatch || title.includes("model") || title.includes("network") || title.includes("learning");
    }

    return hasDirectMatch || src.type === "Technical Literature";
  });
}

/**
 * Step 4: Verifier Agent (Academic & Temporal Fact-Checker)
 * Audits raw subagent findings, checks publication timelines, cross-validates benchmarks, and filters noise.
 */
async function verifyAndAuditEvidence(
  topic: string,
  plan: ResearchPlan,
  subagentResults: SubagentFinding[],
  gateway: ReturnType<typeof createAiGatewayProvider>,
  modelName: string,
): Promise<{
  verifiedDossier: string;
  verifiedSources: { title: string; url: string; yearOrId: string; type: string }[];
}> {
  const allRawSources: { title: string; url: string; yearOrId: string; type: string }[] = [];
  const seenUrls = new Set<string>();

  // Collect all sources from subagents
  for (const sub of subagentResults) {
    for (const p of sub.papers) {
      const url = p.url || `https://arxiv.org/abs/${p.id}`;
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        allRawSources.push({
          title: p.title,
          url,
          yearOrId: p.published ? p.published.slice(0, 4) : p.id ? `arXiv:${p.id}` : "arXiv",
          type: "arXiv Paper",
        });
      }
    }
    for (const w of sub.webSources) {
      if (w.url && !seenUrls.has(w.url)) {
        seenUrls.add(w.url);
        allRawSources.push({
          title: w.title,
          url: w.url,
          yearOrId: "Web Source",
          type: "Technical Literature",
        });
      }
    }
  }

  // Filter sources using domain-aware relevance matching
  const allVerifiedSources = filterRelevantSources(allRawSources, topic);

  const subagentDumps: string[] = [];
  for (const [idx, sub] of subagentResults.entries()) {
    subagentDumps.push(`### Subtask ${idx + 1}: ${sub.title}`);
    subagentDumps.push(`Objective: ${sub.objective}`);
    subagentDumps.push(`Key Architectures: ${sub.keyArchitectures.join(", ")}`);
    subagentDumps.push(`Findings:\n${sub.findingsSummary}`);
    subagentDumps.push("");
  }

  const verifierPrompt = `You are the Lead Academic Verifier and Fact-Checking Agent at Remispace.
Audit and cross-verify the following empirical findings gathered by parallel research subagents for the topic: "${topic}".

Scope: ${plan.scope}
Temporal Bounds: ${plan.temporalConstraints}

Raw Subagent Findings:
${subagentDumps.join("\n")}

Your Verification Tasks:
1. TEMPORAL AUDIT: Cross-check dates. Clearly label which findings are from recent publications (${plan.temporalConstraints}) vs. older foundational baselines.

2. HALLUCINATION FIREWALL & PRICE/DATA CALIBRATION:
   - REJECT any numeric statistic (R², RMSE, correlation coefficients, percentage changes) that was NOT explicitly sourced from a real, named publication in the raw findings above.
   - Do NOT invent or synthesize any figures. If a statistic has no traceable citation, write "[Unverified — omit from report]" next to it.
   - Ground baseline asset prices in empirical market reality (e.g. Gold traded in the ~$2,000–$2,800/oz range across 2024–2025, with consensus baseline forecast ranges around ~$2,600–$3,200/oz). Reject anomalous price levels (e.g. $5,000+ spot claims) unless quoting a specific extreme scenario from a named source.
   - Central Bank Gold Demand: Global central bank demand according to the World Gold Council is on the scale of ~1,000+ tons annually (~200–300+ tons per quarter). Reject trivial misstated quantities (e.g. 16 tons).
   - Do NOT treat future projections as historical facts. Any price move or market event after ${new Date().getFullYear()} that is not in a published source must be labeled as "[Speculative — label as hypothetical in report]".

3. CITATION RELEVANCE AUDIT:
   - Strictly exclude any citation whose subject matter is disconnected from the research topic (e.g., papers on chatbots, medical models, or crypto must NOT appear in a gold price study).

4. EMPIRICAL INTEGRITY:
   - Only include benchmark comparisons or model performance metrics if they come from a named, traceable source. For metrics without traceable sources, replace with a qualitative description (e.g., "Hybrid models generally outperform ARIMA baselines based on recent literature").

5. OUTPUT: Produce a clean, verified research dossier containing only substantiated facts, properly sourced claims, and clearly labeled qualitative assessments. Mark all unverified claims clearly.`;

  const { text: verifiedDossier } = await generateText({
    model: gateway(modelName),
    system:
      "You are a rigorous Academic Verifier Agent. You cross-check literature, reject fabricated statistics, audit temporal constraints, validate mathematical equations, and filter out hallucinations. Your primary job is to prevent the writer from citing synthetic data.",
    prompt: verifierPrompt,
  });

  return {
    verifiedDossier,
    verifiedSources: allVerifiedSources,
  };
}

/**
 * Step 5: Writer Agent (Scientific Publication Writer)
 * Takes verified evidence and composes a clean, publication-grade, beautifully structured technical report.
 */
async function writePublicationReport(
  topic: string,
  plan: ResearchPlan,
  verifiedDossier: string,
  verifiedSources: { title: string; url: string; yearOrId: string; type: string }[],
  gateway: ReturnType<typeof createAiGatewayProvider>,
  modelName: string,
): Promise<{ report: string; sourcesMarkdown: string }> {
  // Only include verified relevant sources in the bibliography
  const formattedSources = verifiedSources
    .slice(0, 12)
    .map((s, i) => `${i + 1}. [**${s.title}**](${s.url}) (${s.yearOrId}) — *${s.type}*`)
    .join("\n");

  const sourcesMarkdown = `### Sources & Literature References\n\n${formattedSources}`;

  const writerPrompt = `You are the Principal Science Writer Agent at Remispace.
Write a definitive, publication-grade, clean technical research report based strictly on the verified research dossier.

User Topic: "${topic}"
Research Scope: ${plan.scope}

Verified Research Dossier (from Verifier Agent):
${verifiedDossier}

Report Structure:
1. Executive Summary & Paradigm Shifts:
   High-level breakthrough context, core principles, and foundational shifts.
2. Core Technical Deep Dives:
   - Concrete architectural, economic, and mechanical explanations.
   - Use standard LaTeX math formulas ($inline$ or $$block$$) for equations — NEVER duplicate the same equation in both inline and block form.
   - Accurate attribution of methods with publication years.
3. Summary Comparison Table (Valid Markdown Table):
   Clean Markdown table comparing key architectures, mechanisms, empirical benchmarks, and verified trade-offs.
4. Key Takeaways & Practical Recommendations.
5. Conclusion with short-term outlook (if requested).

Strict Writing Rules — All Must Be Followed:

1. ZERO EMOJIS: Keep the entire report completely emoji-free.

2. PRICE & MACROECONOMIC CALIBRATION:
   - Spot price baselines and forecasts must be realistic and calibrated to real-world market ranges (e.g. Gold spot baseline ~$2,400–$2,800/oz; near-term 3–6M scenarios ~$2,600–$3,200/oz). Do NOT fabricate anomalous $5,000+ spot prices unless citing a labeled tail-risk scenario.
   - Global central bank gold accumulation should reflect World Gold Council metrics (~1,000+ tons/year, ~200–300 tons/quarter across major central banks).

3. NO HALLUCINATED STATISTICS:
   - Do NOT invent R², RMSE, correlation coefficients, or percentage changes.
   - Only quote numeric figures that are explicitly present in the verified dossier above.
   - If the dossier marks something as "[Unverified — omit]", do NOT include it.
   - If a model comparison exists but has no specific metrics, write qualitatively: e.g. "Recent literature suggests hybrid CNN-LSTM models outperform traditional ARIMA baselines in short-horizon financial forecasting."

4. TEMPORAL HONESTY:
   - Any event or price move tagged "[Speculative — label as hypothetical in report]" in the dossier MUST be written in future/conditional tense: "If X occurs..." or "In an upside scenario..."
   - Do NOT present speculative projections as historical facts.

5. NO DUPLICATE EQUATIONS:
   - Each LaTeX formula must appear exactly once — choose $$block$$ or $inline$, never both for the same formula.

6. CITATION QUALITY:
   - Do NOT cite papers that are off-topic or irrelevant (e.g. do not cite customer service chatbots, vision models, or crypto papers in a precious metals report).

7. DOLLAR AMOUNTS & NUMBERS:
   - Write dollar amounts as plain text (e.g., "$2,800" or "$3,200") — do NOT wrap them in LaTeX math mode.
   - Use ranges like "$2,700–$3,100" with a proper en-dash.

8. TABLE FORMATTING:
   - All markdown tables must be properly formatted with | separators.
   - Do not leave raw table fragments without headers.

9. Clean, structured, highly readable Markdown formatting.`;

  const { text } = await generateText({
    model: gateway(modelName),
    system:
      "You are a Principal Science Writer Agent. You compose publication-grade, mathematically rigorous, beautifully structured research reports without emojis.",
    prompt: writerPrompt,
  });

  return {
    report: `${text}\n\n${sourcesMarkdown}`,
    sourcesMarkdown,
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

  // 2. Research Subagents: Parallel Worker Execution
  recordStep(
    "Research Subagents",
    `Spawning ${subtasks.length} parallel worker subagents across arXiv, Semantic Scholar, and Web index.`,
  );

  const subagentPromises = subtasks.map((subtask) =>
    executeSubagentWorker(subtask, gateway, modelName).catch((err) => {
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
    }),
  );

  const subagentResults = await Promise.all(subagentPromises);

  for (const res of subagentResults) {
    recordStep(
      `Research Subagent: ${res.title}`,
      `Retrieved ${res.papers.length} academic papers and ${res.webSources.length} web sources.`,
    );
  }

  // 3. Verifier Agent: Academic Fact-Checking & Temporal Verification
  recordStep(
    "Verifier Agent",
    "Auditing temporal claims, verifying benchmark data, and cross-validating mathematical equations.",
  );

  const { verifiedDossier, verifiedSources } = await verifyAndAuditEvidence(
    params.topic,
    plan,
    subagentResults,
    gateway,
    modelName,
  );

  // 4. Writer Agent: Technical Report Composition
  recordStep(
    "Writer Agent",
    "Composing clean, publication-grade technical report with comparison matrix and LaTeX formulations.",
  );

  const { report, sourcesMarkdown } = await writePublicationReport(
    params.topic,
    plan,
    verifiedDossier,
    verifiedSources,
    gateway,
    modelName,
  );

  recordStep("Final Synthesis Complete", "Delivered verified, multi-agent publication report.");

  log("info", "deep_research_completed", {
    topic: params.topic,
    subtasksCount: subtasks.length,
    totalPapersRetrieved: subagentResults.reduce((acc, s) => acc + s.papers.length, 0),
  });

  return {
    topic: params.topic,
    plan,
    subtasks,
    subagentResults,
    report,
    sourcesMarkdown,
    actionTrail,
  };
}
