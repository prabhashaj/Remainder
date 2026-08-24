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

export interface ArxivSearchOptions {
  sortBy?: "relevance" | "submittedDate" | "lastUpdatedDate" | undefined;
  maxResults?: number | undefined;
  yearMin?: number | undefined;
  category?: string | undefined;
}

export interface PaperSearchOptions {
  maxResults?: number | undefined;
  yearMin?: number | undefined;
}

/**
 * Searches arXiv for research papers using the free public arXiv REST API.
 */
export async function searchArxivServer(
  query: string,
  options?: ArxivSearchOptions,
): Promise<ArxivPaper[]> {
  const cleanQuery = query
    .replace(/[()[\]{}"']/g, " ")
    .replace(/\s+(AND|OR|NOT)\s+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleanQuery) return [];

  const sortBy = options?.sortBy ?? "relevance";
  const maxResults = Math.min(options?.maxResults ?? 8, 20);

  let searchQuery = `all:${cleanQuery}`;
  if (options?.category) {
    searchQuery = `cat:${options.category} AND all:${cleanQuery}`;
  }

  try {
    const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(searchQuery)}&max_results=${maxResults}&sortBy=${sortBy}&sortOrder=descending`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Remispace-Academic-Search/1.0" },
    });

    if (res.ok) {
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
        const rawTitle =
          titleMatch && titleMatch[1] ? titleMatch[1].replace(/\s+/g, " ").trim() : "Untitled";
        const rawSummary =
          summaryMatch && summaryMatch[1] ? summaryMatch[1].replace(/\s+/g, " ").trim() : "";
        const published =
          publishedMatch && publishedMatch[1] ? (publishedMatch[1].trim().split("T")[0] ?? "") : "";

        // If yearMin is specified, filter out older papers
        if (options?.yearMin && published) {
          const pubYear = parseInt(published.slice(0, 4), 10);
          if (!isNaN(pubYear) && pubYear < options.yearMin) {
            continue;
          }
        }

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

      if (entries.length > 0) {
        return entries;
      }
    } else {
      log("warn", "arxiv_api_error_fallback", { status: res.status, query: cleanQuery });
    }
  } catch (err) {
    log("warn", "arxiv_search_exception_fallback", { error: String(err), query: cleanQuery });
  }

  // Fallback: Search arXiv preprints via Tavily Academic Search
  try {
    const yearHint = options?.yearMin ? ` ${options.yearMin}` : "";
    const tavilyQuery = `site:arxiv.org ${cleanQuery}${yearHint}`;
    const tavilyRes = await tavilySearch(tavilyQuery, { maxResults, depth: "basic" });

    return (tavilyRes.results || []).map((r) => {
      const arxivMatch = /arxiv\.org\/(?:abs|pdf)\/([0-9.]+)/i.exec(r.url);
      const arxivId = arxivMatch ? arxivMatch[1]! : r.url;
      const cleanTitle = r.title.replace(/^\[.*?\]\s*/, "").replace(/\s*-\s*arXiv.*$/i, "");
      return {
        id: arxivId,
        title: cleanTitle || r.title,
        summary: r.content,
        authors: ["arXiv Preprint"],
        published: options?.yearMin ? `${options.yearMin}` : new Date().getFullYear().toString(),
        pdfUrl: arxivMatch ? `https://arxiv.org/pdf/${arxivId}.pdf` : r.url,
        arxivUrl: arxivMatch ? `https://arxiv.org/abs/${arxivId}` : r.url,
      };
    });
  } catch (tavilyErr) {
    log("error", "arxiv_tavily_fallback_failed", { error: String(tavilyErr), query: cleanQuery });
    return [];
  }
}

/**
 * Searches multi-platform academic paper databases (Semantic Scholar with OpenAlex fallback).
 */
export async function searchPapersServer(
  query: string,
  options?: PaperSearchOptions,
): Promise<AcademicPaper[]> {
  try {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const limit = Math.min(options?.maxResults ?? 6, 15);
    const yearParam = options?.yearMin ? `&year=${options.yearMin}-` : "";

    // Try Semantic Scholar REST API first
    const s2Url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(cleanQuery)}&limit=${limit}&fields=title,authors,abstract,url,year,citationCount${yearParam}`;
    const s2Res = await fetch(s2Url, {
      headers: { "User-Agent": "Remispace-Paper-Search/1.0" },
    });

    if (s2Res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (await s2Res.json()) as any;
      if (data && Array.isArray(data.data) && data.data.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results = data.data.map((p: any) => ({
          title: p.title || "Untitled",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          authors: Array.isArray(p.authors) ? p.authors.map((a: any) => a.name) : [],
          abstract: p.abstract || "No abstract available.",
          year: p.year || undefined,
          url: p.url || `https://www.semanticscholar.org/paper/${p.paperId}`,
          citationCount: p.citationCount ?? 0,
        }));

        if (options?.yearMin) {
          return results.filter((p: AcademicPaper) => !p.year || p.year >= options.yearMin!);
        }
        return results;
      }
    }

    // Fallback to OpenAlex API (100% free open academic database)
    const oaFilter = options?.yearMin ? `&filter=from_publication_date:${options.yearMin}-01-01` : "";
    const oaUrl = `https://api.openalex.org/works?search=${encodeURIComponent(cleanQuery)}&per-page=${limit}${oaFilter}`;
    const oaRes = await fetch(oaUrl, {
      headers: { "User-Agent": "Remispace-Paper-Search/1.0" },
    });

    if (oaRes.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oaData = (await oaRes.json()) as any;
      if (oaData && Array.isArray(oaData.results) && oaData.results.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return oaData.results.map((w: any) => ({
          title: w.title || "Untitled",
          authors: Array.isArray(w.authorships)
            ? w.authorships.map((a: any) => a.author?.display_name).filter(Boolean)
            : [],
          abstract: "Abstract available at source link.",
          year: w.publication_year,
          url: w.doi || w.id || `https://openalex.org/${w.id}`,
          citationCount: w.cited_by_count ?? 0,
        }));
      }
    }

    // Secondary Fallback: Web search targeting Google Scholar / ResearchGate / ArXiv via Tavily
    const webResults = await tavilySearch(
      `site:arxiv.org OR site:semanticscholar.org OR site:researchgate.net ${cleanQuery}`,
      { maxResults: 6, depth: "basic" },
    );
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
    const webResults = await tavilySearch(searchQuery, { maxResults: 4, depth: "basic" });

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
