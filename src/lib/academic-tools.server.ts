import { tavilySearch, type WebResult } from "@/lib/tavily.server";
import { log } from "@/lib/logger.server";

export interface ArxivPaper {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  published: string;
  pdfUrl: string;
  arxivUrl: string;
}

export interface AcademicPaper {
  title: string;
  authors: string[];
  abstract: string;
  year?: number;
  url: string;
  citationCount?: number;
}

export interface DocResult {
  title: string;
  url: string;
  content: string;
}

/**
 * Searches arXiv for research papers using the free public arXiv REST API.
 */
export async function searchArxivServer(query: string): Promise<ArxivPaper[]> {
  try {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(cleanQuery)}&max_results=5&sortBy=relevance&sortOrder=descending`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Remainderr-Academic-Search/1.0" },
    });

    if (!res.ok) {
      log("warn", "arxiv_api_error", { status: res.status, query });
      return [];
    }

    const xmlText = await res.text();
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    const entries: ArxivPaper[] = [];

    let match: RegExpExecArray | null;
    while ((match = entryRegex.exec(xmlText)) !== null) {
      const entryContent = match[1] ?? "";

      const idMatch = /<id>([\s\S]*?)<\/id>/.exec(entryContent);
      const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(entryContent);
      const summaryMatch = /<summary>([\s\S]*?)<\/summary>/.exec(entryContent);
      const publishedMatch = /<published>([\s\S]*?)<\/published>/.exec(entryContent);

      const authorRegex = /<author>\s*<name>([\s\S]*?)<\/name>\s*<\/author>/g;
      const authors: string[] = [];
      let authorMatch: RegExpExecArray | null;
      while ((authorMatch = authorRegex.exec(entryContent)) !== null) {
        if (authorMatch[1]) {
          authors.push(authorMatch[1].trim());
        }
      }

      const arxivId = idMatch && idMatch[1] ? idMatch[1].trim() : "";
      const rawTitle = titleMatch && titleMatch[1] ? titleMatch[1].replace(/\s+/g, " ").trim() : "Untitled";
      const rawSummary = summaryMatch && summaryMatch[1] ? summaryMatch[1].replace(/\s+/g, " ").trim() : "";
      const published = publishedMatch && publishedMatch[1] ? publishedMatch[1].trim().split("T")[0] ?? "" : "";

      const pdfUrl = arxivId ? arxivId.replace("/abs/", "/pdf/") + ".pdf" : "";

      entries.push({
        id: arxivId,
        title: rawTitle,
        summary: rawSummary,
        authors: authors.slice(0, 5),
        published,
        pdfUrl,
        arxivUrl: arxivId,
      });
    }

    return entries;
  } catch (err) {
    log("error", "arxiv_search_failed", { error: String(err), query });
    return [];
  }
}

/**
 * Searches multi-platform academic paper databases (Semantic Scholar with OpenAlex fallback).
 */
export async function searchPapersServer(query: string): Promise<AcademicPaper[]> {
  try {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    // Try Semantic Scholar REST API first
    const s2Url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(cleanQuery)}&limit=5&fields=title,authors,abstract,url,year,citationCount`;
    const s2Res = await fetch(s2Url, {
      headers: { "User-Agent": "Remainderr-Paper-Search/1.0" },
    });

    if (s2Res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (await s2Res.json()) as any;
      if (data && Array.isArray(data.data) && data.data.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return data.data.map((p: any) => ({
          title: p.title || "Untitled",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          authors: Array.isArray(p.authors) ? p.authors.map((a: any) => a.name) : [],
          abstract: p.abstract || "No abstract available.",
          year: p.year || undefined,
          url: p.url || `https://www.semanticscholar.org/paper/${p.paperId}`,
          citationCount: p.citationCount ?? 0,
        }));
      }
    }

    // Fallback to OpenAlex API (100% free open academic database)
    const oaUrl = `https://api.openalex.org/works?search=${encodeURIComponent(cleanQuery)}&per-page=5`;
    const oaRes = await fetch(oaUrl, {
      headers: { "User-Agent": "Remainderr-Paper-Search/1.0" },
    });

    if (oaRes.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oaData = (await oaRes.json()) as any;
      if (oaData && Array.isArray(oaData.results) && oaData.results.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return oaData.results.map((w: any) => ({
          title: w.title || "Untitled",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          authors: Array.isArray(w.authorships) ? w.authorships.map((a: any) => a.author?.display_name).filter(Boolean) : [],
          abstract: "Abstract available at source link.",
          year: w.publication_year,
          url: w.doi || w.id || `https://openalex.org/${w.id}`,
          citationCount: w.cited_by_count ?? 0,
        }));
      }
    }

    // Secondary Fallback: Web search targeting Google Scholar / ResearchGate / ArXiv via Tavily
    const webResults = await tavilySearch(`site:arxiv.org OR site:semanticscholar.org OR site:researchgate.net ${cleanQuery}`, { maxResults: 5 });
    return (webResults.results || []).map((r: WebResult) => ({
      title: r.title,
      authors: [],
      abstract: r.content,
      url: r.url,
    }));
  } catch (err) {
    log("error", "paper_search_failed", { error: String(err), query });
    return [];
  }
}

/**
 * Searches framework & library documentation.
 */
export async function searchDocsServer(library: string, topic: string): Promise<DocResult[]> {
  try {
    const searchQuery = `${library} ${topic} official documentation guide example`;
    const webResults = await tavilySearch(searchQuery, { maxResults: 4 });

    return (webResults.results || []).map((r: WebResult) => ({
      title: r.title,
      url: r.url,
      content: r.content,
    }));
  } catch (err) {
    log("error", "docs_search_failed", { error: String(err), library, topic });
    return [];
  }
}
