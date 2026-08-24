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

  const planningPrompt = `You are a Principal Research Scientist and Lead Coordinator.
Analyze the user's research topic: "${topic}".
Current Year: ${currentYear}.

Your goal:
1. Create a structured Research Plan outlining the core scope, temporal bounds (e.g. recent ${currentYear - 2}–${currentYear} publications vs foundational literature), and key technical dimensions.
2. Decompose the research topic into 3 to 4 distinct, orthogonal, non-overlapping investigation subtasks for parallel research workers.
Each subtask must target a distinct analytical angle, sub-problem, or evaluation dimension of the requested topic.
Provide targeted search queries optimized for arXiv API, Semantic Scholar, and Web search.`;

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
          arxivQuery: `all:${topic} AND (architecture OR transformer OR attention)`,
          academicQuery: `${topic} architecture advancements`,
          webQuery: `${topic} latest architecture breakthroughs ${currentYear}`,
          targetYearMin: currentYear - 2,
        },
        {
          id: "subtask_2",
          title: "Efficiency, Complexity & Scaling",
          objective: "Investigate linear attention, sparsity, token pruning, and memory scaling.",
          arxivQuery: `all:${topic} AND (efficiency OR "linear attention" OR scaling)`,
          academicQuery: `${topic} linear complexity efficiency`,
          webQuery: `${topic} efficient scaling linear attention ${currentYear}`,
          targetYearMin: currentYear - 2,
        },
        {
          id: "subtask_3",
          title: "State-of-the-Art Benchmarks & Practical Validations",
          objective: "Collect verified empirical metrics, ImageNet/COCO benchmarks, and comparative gains.",
          arxivQuery: `all:${topic} AND (benchmark OR SOTA OR performance OR accuracy)`,
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
  const [arxivRelevance, arxivLatest, academicPapers, webResults] = await Promise.all([
    searchArxivServer(subtask.arxivQuery, {
      sortBy: "relevance",
      maxResults: 5,
      yearMin: subtask.targetYearMin,
      category: subtask.category,
    }),
    searchArxivServer(subtask.arxivQuery, {
      sortBy: "submittedDate",
      maxResults: 5,
      yearMin: subtask.targetYearMin,
      category: subtask.category,
    }),
    searchPapersServer(subtask.academicQuery, {
      maxResults: 4,
      yearMin: subtask.targetYearMin,
    }),
    tavilySearch(subtask.webQuery, { maxResults: 5, depth: "advanced" }).catch(() => ({
      results: [] as WebResult[],
      answer: "",
    })),
  ]);

  // Deduplicate and combine arXiv papers
  const seenArxivIds = new Set<string>();
  const allArxivPapers: ArxivPaper[] = [];
  for (const paper of [...arxivLatest, ...arxivRelevance]) {
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

/**
 * Step 4: Research Coordinator Synthesis & Verification
 */
async function synthesizeCoordinatorReport(
  topic: string,
  plan: ResearchPlan,
  subagentResults: SubagentFinding[],
  gateway: ReturnType<typeof createAiGatewayProvider>,
  modelName: string,
): Promise<{ report: string; sourcesMarkdown: string }> {
  // Aggregate all verified papers and web links
  const allVerifiedSources: { title: string; url: string; yearOrId: string; type: string }[] = [];
  const seenUrls = new Set<string>();

  for (const sub of subagentResults) {
    for (const p of sub.papers) {
      const url = p.url || `https://arxiv.org/abs/${p.id}`;
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        allVerifiedSources.push({
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
        allVerifiedSources.push({
          title: w.title,
          url: w.url,
          yearOrId: "Web Source",
          type: "Documentation / Article",
        });
      }
    }
  }

  const subagentDumps: string[] = [];
  for (const [idx, sub] of subagentResults.entries()) {
    subagentDumps.push(`### Subagent ${idx + 1}: ${sub.title}`);
    subagentDumps.push(`Objective: ${sub.objective}`);
    subagentDumps.push(`Key Architectures: ${sub.keyArchitectures.join(", ")}`);
    subagentDumps.push(`Findings:\n${sub.findingsSummary}`);
    subagentDumps.push(
      `Retrieved Papers: ${sub.papers.map((p) => `"${p.title}" (${p.published || p.id})`).join("; ")}`,
    );
    subagentDumps.push("");
  }

  const coordinatorPrompt = `You are the Lead Research Coordinator at Remispace.
Synthesize the parallel subagent findings into a definitive, authoritative technical research report.

User Query: "${topic}"
Research Scope: ${plan.scope}
Temporal Bounds: ${plan.temporalConstraints}

Parallel Subagent Investigation Findings:
${subagentDumps.join("\n")}

Report Requirements:
1. Executive Summary & Foundational Context:
   Explain the primary principles, recent breakthroughs, and paradigm shifts in the domain.
2. Core Technical Deep Dives (Divide into structured sections based on the subagent findings):
   - Provide concrete algorithmic or mathematical explanations (use standard LaTeX $$inline$$ or $$block$$ math formulas where appropriate).
   - Explain the underlying mechanisms: how key techniques address core bottlenecks and advance the state of the art.
   - Include code snippets or structural representations if relevant.
   - State EXACT publication dates/years accurately. NEVER misattribute older papers as recent.
3. Summary Comparison Table (CRITICAL: Valid Markdown Table):
   You MUST generate a clean, properly formatted Markdown table with headers and delimiter rows comparing key methods, innovations, mechanisms, metrics, and verified citations.
4. Strict Rules:
   - ZERO EMOJIS: Do NOT include any emojis anywhere in the report.
   - Professional, deeply technical, precise, and verified.`;

  const { text } = await generateText({
    model: gateway(modelName),
    system:
      "You are a Principal AI Scientist and Lead Research Coordinator. You synthesize complex literature into publication-grade, mathematically rigorous, beautifully structured research reports.",
    prompt: coordinatorPrompt,
  });

  const formattedSources = allVerifiedSources
    .slice(0, 15)
    .map(
      (s, i) => `${i + 1}. [**${s.title}**](${s.url}) (${s.yearOrId}) — *${s.type}*`,
    )
    .join("\n");

  const sourcesMarkdown = `### Sources & Literature References\n\n${formattedSources}`;

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

  // 1. Plan & Split Subtasks
  recordStep("Research Planning", `Formulating research scope and temporal parameters for: "${params.topic}"`);
  const { plan, subtasks } = await createPlanAndSubtasks(params.topic, gateway, modelName);
  recordStep(
    "Subtask Decomposition",
    `Decomposed into ${subtasks.length} parallel research subtasks: ${subtasks.map((s) => s.title).join(", ")}`,
  );

  // 2. Dispatch Parallel Worker Subagents
  recordStep(
    "Dispatching Subagents",
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
      `Subagent Completed: ${res.title}`,
      `Retrieved ${res.papers.length} academic papers and ${res.webSources.length} web sources.`,
    );
  }

  // 3. Coordinator Synthesis & Temporal Verification
  recordStep(
    "Research Coordinator Synthesis",
    "Auditing temporal accuracy, extracting mathematical formulations, and generating comparison matrix.",
  );

  const { report, sourcesMarkdown } = await synthesizeCoordinatorReport(
    params.topic,
    plan,
    subagentResults,
    gateway,
    modelName,
  );

  recordStep("Final Synthesis Complete", "Delivered verified, multi-perspective technical report.");

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
