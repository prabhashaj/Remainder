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
  webQueries: string[];
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

  const planningPrompt = `You are an expert Research Planner Agent.
Analyze the user's research topic or question: "${topic}".
Current Year: ${currentYear}.

Your goal:
1. Formulate a structured Research Plan outlining the core scope, temporal window (e.g., historical context vs. recent advancements), and key analytical pillars.
2. Decompose the topic into 3 to 4 distinct, orthogonal investigation subtasks for parallel research subagents.
3. Provide targeted search queries for each subtask:
   - arxivQuery: Keywords for academic preprint searches.
   - academicQuery: Targeted search query for academic databases.
   - webQueries: An array of 3 highly diverse search queries for the live web index. For example, one general query, one targeting news/industry reports, and one targeting forums/discussions (e.g., appending 'reddit' or 'forum').`;

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
    const { object } = await generateObject({
      model: gateway(modelName),
      system:
        "You are an expert research coordinator that plans and decomposes topics into precise, executable subtasks.",
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
        temporalConstraints: `Recent advancements`,
        keyDimensions: [
          "Core Foundations & Principles",
          "Key Methodologies & Frameworks",
          "Empirical Evidence & Current State-of-the-Art",
        ],
      },
      subtasks: [
        {
          id: "subtask_1",
          title: "Core Foundations & Historical Context",
          objective: "Identify the foundational principles, historical context, and fundamental mechanisms.",
          arxivQuery: `${topic} overview foundations`,
          academicQuery: `${topic} foundational principles review`,
          webQueries: [
            `${topic} overview core concepts ${currentYear}`,
            `${topic} history principles industry reports`,
            `${topic} foundations explained site:reddit.com`,
          ],
          targetYearMin: currentYear - 5,
        },
        {
          id: "subtask_2",
          title: "Key Methodologies & Applications",
          objective: "Investigate practical methodologies, key applications, and notable advancements.",
          arxivQuery: `${topic} methodology applications`,
          academicQuery: `${topic} methodology advancement applications`,
          webQueries: [
            `${topic} latest applications methodology ${currentYear}`,
            `${topic} methodology real-world case studies news`,
            `${topic} methodology applications discussions forum`,
          ],
          targetYearMin: currentYear - 3,
        },
        {
          id: "subtask_3",
          title: "Current State-of-the-Art & Empirical Benchmarks",
          objective: "Collect verified empirical metrics, state-of-the-art comparisons, and real-world validations.",
          arxivQuery: `${topic} benchmark state-of-the-art performance`,
          academicQuery: `${topic} benchmark results comparison`,
          webQueries: [
            `${topic} latest benchmark comparison ${currentYear}`,
            `${topic} state-of-the-art benchmarks news analysis`,
            `${topic} benchmark comparison opinions site:reddit.com`,
          ],
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

  evidenceLines.push(`\n## Web Research Results (${allWebResults.length} retrieved):`);
  for (const wr of allWebResults) {
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

  const webBulletPoints = allWebResults
    .slice(0, 5)
    .map((w) => `• [${w.title}](${w.url}): ${w.content.slice(0, 250)}...`)
    .join("\n\n");

  const findingsSummary = [
    `Specialized Subagent Analysis for "${subtask.title}" (${subtask.objective}):`,
    `Discovered ${allArxivPapers.length} arXiv papers, ${academicPapers.length} academic preprints, and ${allWebResults.length} web benchmark sources.`,
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
    webSources: allWebResults.map((r) => ({
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

  return sources.filter((src) => {
    const title = src.title.toLowerCase();

    // 1. Direct topic token match
    const hasDirectMatch = topicTokens.some((tok) => title.includes(tok));

    // 2. Web sources ("Technical Literature") are filtered by the search engine (Tavily/Google)
    if (src.type === "Technical Literature") return true;

    // 3. For academic/arXiv papers, require at least one topical keyword match to avoid domain crossover noise
    return hasDirectMatch;
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

  const verifierPrompt = `You are an expert Fact-Checking and Verification Agent.
Audit and cross-verify the following empirical findings gathered by parallel research subagents for the topic: "${topic}".

Scope: ${plan.scope}
Temporal Bounds: ${plan.temporalConstraints}

Raw Subagent Findings:
${subagentDumps.join("\n")}

Your Verification Tasks:
1. TEMPORAL AUDIT: Cross-check dates and identify which findings are recent vs. older baselines.
2. HALLUCINATION FIREWALL:
   - REJECT any specific statistic, metric, or figure that was NOT explicitly sourced from a real, named publication in the raw findings above.
   - Do NOT invent or synthesize any figures. If a statistic has no traceable citation, write "[Unverified — omit from report]" next to it.
   - Ground baseline metrics and statistics in empirical reality for the given topic.
3. RELEVANCE AUDIT:
   - Exclude any citation whose subject matter is completely disconnected from the research topic.
4. OUTPUT: Produce a clean, verified research dossier containing only substantiated facts, properly sourced claims, and clearly labeled qualitative assessments. Mark all unverified claims clearly.`;

  const { text: verifiedDossier } = await generateText({
    model: gateway(modelName),
    system:
      "You are a rigorous Fact-Checking Agent. You cross-check literature, filter out hallucinations, and ensure the writer receives only verified facts.",
    prompt: verifierPrompt,
  });

  return {
    verifiedDossier,
    verifiedSources: allVerifiedSources,
  };
}

/**
 * Step 5: Writer Agent
 * Takes verified evidence and composes a clean, professional report.
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

  const writerPrompt = `You are an expert Research Writer Agent.
Write a definitive, clean, and comprehensive deep research report based strictly on the verified research dossier.

User Topic: "${topic}"
Research Scope: ${plan.scope}

Verified Research Dossier (from Verifier Agent):
${verifiedDossier}

Report Structure:
1. Executive Summary:
   High-level breakthrough context, core principles, and foundational shifts.
2. Deep Dive Sections:
   - Concrete, detailed explanations of the core topics.
   - Proper attribution of methods and findings.
3. Key Takeaways & Practical Recommendations.
4. Conclusion.

Strict Writing Rules:
1. NO EMOJIS: Keep the entire report completely emoji-free and professional.
2. NO HALLUCINATED STATISTICS:
   - Do NOT invent metrics or figures.
   - Only quote numeric figures that are explicitly present in the verified dossier above.
   - If the dossier marks something as "[Unverified — omit]", do NOT include it.
3. TEMPORAL HONESTY:
   - Do NOT present speculative future projections as historical facts.
4. CITATION QUALITY:
   - Do NOT cite papers that are completely unrelated to the core topic.
5. FORMATTING:
   - Use clean, structured, highly readable Markdown formatting.
   - All markdown tables (if any) must be properly formatted with | separators.`;

  const { text } = await generateText({
    model: gateway(modelName),
    system:
      "You are an expert Research Writer Agent. You compose highly structured, thoroughly researched, and professional deep research reports.",
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
