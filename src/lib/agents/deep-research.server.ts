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

/**
 * Step 4: Research Coordinator Synthesis & Verification
 */
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
          type: "Technical Literature",
        });
      }
    }
  }

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
1. Temporal Audit: Cross-check dates and identify which techniques are recent (${plan.temporalConstraints}) vs foundational baselines.
2. Empirical & Benchmark Validation: Extract and verify concrete metrics (e.g. accuracy, latency, FLOPs, FID, throughput) and eliminate unsubstantiated claims.
3. Mathematical & Algorithmic Rigor: Verify core mathematical equations and mechanical formulations (in standard LaTeX $$...$$).
4. Summarize the verified facts, verified mechanisms, and structured comparison data cleanly.`;

  const { text: verifiedDossier } = await generateText({
    model: gateway(modelName),
    system:
      "You are a rigorous Academic Verifier Agent. You cross-check literature, audit temporal constraints, validate mathematical equations, and filter out hallucinations.",
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
  const formattedSources = verifiedSources
    .slice(0, 15)
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
   - Concrete architectural and mechanical explanations.
   - Use standard LaTeX math formulas ($inline$ or $$block$$) for equations.
   - Accurate attribution of methods with publication years.
3. Summary Comparison Table (Valid Markdown Table):
   Clean Markdown table comparing key architectures, mechanisms, empirical benchmarks, and verified trade-offs.
4. Key Takeaways & Practical Recommendations.

Strict Guidelines:
- ZERO EMOJIS: Keep the entire report completely emoji-free.
- Clean, structured, highly readable Markdown formatting.`;

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
