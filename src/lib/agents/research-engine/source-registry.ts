/**
 * Canonical Source Registry & Entity Resolution Engine
 * Remispace Deep Research Agent
 */

import { classifySourceTier } from "./source-ranking";
import type { CanonicalSource, SourceTier } from "./types";

export interface RawSourceInput {
  title: string;
  url: string;
  authors?: string[] | undefined;
  year?: number | undefined;
  preprintYear?: number | undefined;
  yearOrId?: string | undefined;
  venue?: string | undefined;
  doi?: string | undefined;
  arxivId?: string | undefined;
  publisher?: string | undefined;
  type?: string | undefined;
  content?: string | undefined;
  citationCount?: number | undefined;
  paperContribution?: string | undefined;
  hasExperiments?: boolean | undefined;
}

/**
 * Normalizes title strings for robust entity matching.
 */
export function normalizeTitle(title: string): string {
  if (!title) return "";
  return title
    .toLowerCase()
    .replace(/^\[(?:pdf|arxiv|html|doc)\]\s*/i, "")
    .replace(/\s*-\s*arxiv(?:\s*preprint|\s*:\s*[\d.]+)?$/i, "")
    .replace(/\s*\|\s*proceedings of .*$/i, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts normalized arXiv ID from URL or text.
 */
export function extractArxivId(input: string): string | undefined {
  if (!input) return undefined;
  const match = /(?:arxiv\.org\/(?:abs|pdf)\/|arxiv:\s*|10\.48550\/arxiv\.)(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[a-z]{2})?\/\d{7})/i.exec(input);
  return match ? match[1]!.replace(/v\d+$/i, "").toLowerCase() : undefined;
}

/**
 * Extracts DOI from URL or text.
 */
export function extractDoi(input: string): string | undefined {
  if (!input) return undefined;
  const match = /(?:doi\.org\/|doi:\s*)(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i.exec(input);
  return match ? match[1]!.toLowerCase() : undefined;
}

/**
 * Normalizes author list into a set of lowercase surnames.
 */
export function extractAuthorSurnames(authors?: string[]): string[] {
  if (!authors || !Array.isArray(authors) || authors.length === 0) return [];
  return authors
    .map((author) => {
      const clean = author.replace(/[^\w\s]/g, "").trim().toLowerCase();
      const parts = clean.split(/\s+/);
      return parts[parts.length - 1] || "";
    })
    .filter((s) => s.length >= 2 && !["et", "al", "author", "authors", "team", "research"].includes(s));
}

/**
 * Calculates token-level Jaccard similarity between two strings.
 */
export function calculateTitleSimilarity(titleA: string, titleB: string): number {
  const normA = normalizeTitle(titleA);
  const normB = normalizeTitle(titleB);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  const tokensA = new Set(normA.split(/\s+/).filter((t) => t.length >= 3));
  const tokensB = new Set(normB.split(/\s+/).filter((t) => t.length >= 3));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  const intersection = new Set([...tokensA].filter((x) => tokensB.has(x)));
  const union = new Set([...tokensA, ...tokensB]);
  return intersection.size / union.size;
}

/**
 * Normalizes URL into canonical format (strips tracking, anchors, trailing slashes).
 */
export function normalizeUrl(url: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    // Canonicalize arXiv URL to abs format
    const arxivId = extractArxivId(url);
    if (arxivId) {
      return `https://arxiv.org/abs/${arxivId}`;
    }
    // Canonicalize DOI URL
    const doi = extractDoi(url);
    if (doi) {
      return `https://doi.org/${doi}`;
    }
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname.replace(/\/$/, "")}`;
  } catch {
    return url.replace(/\/$/, "");
  }
}

export class CanonicalSourceRegistry {
  private sources: Map<string, CanonicalSource> = new Map();
  private doiIndex: Map<string, string> = new Map(); // doi -> source_id
  private arxivIndex: Map<string, string> = new Map(); // arxiv_id -> source_id
  private urlIndex: Map<string, string> = new Map(); // normalized_url -> source_id
  private titleIndex: Map<string, string> = new Map(); // normalized_title -> source_id

  /**
   * Registers a raw source input, performing deterministic entity resolution and deduplication.
   */
  public registerSource(raw: RawSourceInput): CanonicalSource {
    const rawUrl = raw.url?.trim() || "";
    const canonicalUrl = normalizeUrl(rawUrl);
    const normalizedTitle = normalizeTitle(raw.title || "");
    const doi = raw.doi ? raw.doi.toLowerCase() : extractDoi(rawUrl) || extractDoi(raw.content || "");
    const arxivId = raw.arxivId ? raw.arxivId.toLowerCase() : extractArxivId(rawUrl) || extractArxivId(raw.content || "");
    const surnames = extractAuthorSurnames(raw.authors);

    // Entity Resolution Priority:
    // 1. DOI
    // 2. arXiv ID
    // 3. Canonical URL
    // 4. Exact normalized title + author surname overlap
    // 5. High title similarity (>= 0.85) + author surname overlap

    let existingId: string | undefined;

    if (doi && this.doiIndex.has(doi)) {
      existingId = this.doiIndex.get(doi);
    } else if (arxivId && this.arxivIndex.has(arxivId)) {
      existingId = this.arxivIndex.get(arxivId);
    } else if (canonicalUrl && this.urlIndex.has(canonicalUrl)) {
      existingId = this.urlIndex.get(canonicalUrl);
    } else if (normalizedTitle && this.titleIndex.has(normalizedTitle)) {
      const candidateId = this.titleIndex.get(normalizedTitle)!;
      const candidate = this.sources.get(candidateId);
      if (candidate) {
        const candidateSurnames = extractAuthorSurnames(candidate.authors);
        const hasAuthorOverlap =
          surnames.length === 0 ||
          candidateSurnames.length === 0 ||
          surnames.some((s) => candidateSurnames.includes(s));
        if (hasAuthorOverlap) {
          existingId = candidateId;
        }
      }
    } else if (normalizedTitle) {
      // Fuzzy title check across existing sources
      for (const [id, candidate] of this.sources.entries()) {
        const similarity = calculateTitleSimilarity(raw.title, candidate.canonical_title);
        if (similarity >= 0.85) {
          const candidateSurnames = extractAuthorSurnames(candidate.authors);
          const hasAuthorOverlap =
            surnames.length === 0 ||
            candidateSurnames.length === 0 ||
            surnames.some((s) => candidateSurnames.includes(s));

          if (hasAuthorOverlap) {
            existingId = id;
            break;
          }
        }
      }
    }

    const classification = classifySourceTier({
      title: raw.title,
      url: canonicalUrl,
      venue: raw.venue,
      type: raw.type,
      abstractOrContent: raw.content,
    });

    const parsedYear = raw.year || (raw.yearOrId ? parseInt(raw.yearOrId, 10) : undefined);
    const validYear = parsedYear && !isNaN(parsedYear) && parsedYear > 1950 && parsedYear <= new Date().getFullYear() ? parsedYear : undefined;

    if (existingId && this.sources.has(existingId)) {
      // Merge into existing canonical entity
      const existing = this.sources.get(existingId)!;

      if (!existing.retrieved_urls.includes(rawUrl) && rawUrl) {
        existing.retrieved_urls.push(rawUrl);
      }
      if (raw.title && raw.title.length > 5 && !existing.aliases.includes(raw.title)) {
        existing.aliases.push(raw.title);
      }

      // Upgrade metadata if higher-quality tier or explicit venue
      if (classification.rank < existing.tierRank) {
        existing.source_tier = classification.tier;
        existing.tierRank = classification.rank;
        existing.isPrimarySource = classification.isPrimary;
      }

      if (raw.venue && !existing.venue) existing.venue = raw.venue;
      if (doi && !existing.doi) {
        existing.doi = doi;
        this.doiIndex.set(doi, existingId);
      }
      if (arxivId && !existing.arxiv_id) {
        existing.arxiv_id = arxivId;
        this.arxivIndex.set(arxivId, existingId);
      }

      // Resolve publication year vs preprint year
      if (validYear) {
        if (!existing.publication_year) {
          existing.publication_year = validYear;
          existing.yearOrId = String(validYear);
        } else if (existing.publication_year !== validYear) {
          // If different, track earlier year as preprint and later as publication
          const earlier = Math.min(existing.publication_year, validYear);
          const later = Math.max(existing.publication_year, validYear);
          existing.preprint_year = earlier;
          existing.publication_year = later;
          existing.yearOrId = `${later} (Preprint ${earlier})`;
        }
      }

      if (raw.authors && raw.authors.length > existing.authors.length && !raw.authors.includes("arXiv Preprint")) {
        existing.authors = raw.authors;
      }
      if (raw.content && (!existing.abstractOrSnippet || raw.content.length > existing.abstractOrSnippet.length)) {
        existing.abstractOrSnippet = raw.content;
      }
      if (raw.hasExperiments !== undefined) {
        existing.has_experiments = existing.has_experiments || raw.hasExperiments;
      }

      return existing;
    }

    // Create new canonical source entity
    const nextIndex = this.sources.size + 1;
    const sourceId = `SOURCE_${String(nextIndex).padStart(3, "0")}`;

    const newSource: CanonicalSource = {
      source_id: sourceId,
      canonical_title: raw.title.trim() || "Untitled Source",
      normalized_title: normalizedTitle,
      authors: raw.authors && raw.authors.length > 0 ? raw.authors : ["Research Author(s)"],
      publication_year: validYear,
      preprint_year: raw.preprintYear,
      yearOrId: validYear ? String(validYear) : raw.yearOrId || "Recent",
      venue: raw.venue,
      doi,
      arxiv_id: arxivId,
      canonical_url: canonicalUrl || rawUrl,
      source_type: raw.type || classification.tier.split(":")[0]!,
      source_tier: classification.tier,
      tierRank: classification.rank,
      publisher: raw.publisher,
      retrieved_urls: rawUrl ? [rawUrl] : [],
      aliases: raw.title ? [raw.title] : [],
      abstractOrSnippet: raw.content || "",
      citationCount: raw.citationCount,
      verification_status: "VERIFIED",
      isPrimarySource: classification.isPrimary,
      paper_contribution: raw.paperContribution,
      has_experiments: raw.hasExperiments ?? (Boolean(raw.content && /experiment|evaluation|benchmark|result|metric/i.test(raw.content))),
    };

    this.sources.set(sourceId, newSource);
    if (doi) this.doiIndex.set(doi, sourceId);
    if (arxivId) this.arxivIndex.set(arxivId, sourceId);
    if (canonicalUrl) this.urlIndex.set(canonicalUrl, sourceId);
    if (normalizedTitle) this.titleIndex.set(normalizedTitle, sourceId);

    return newSource;
  }

  public getSourceById(id: string): CanonicalSource | undefined {
    return this.sources.get(id);
  }

  public getAllSources(): CanonicalSource[] {
    return Array.from(this.sources.values());
  }

  public getTopRankedSources(limit = 10): CanonicalSource[] {
    return Array.from(this.sources.values())
      .sort((a, b) => {
        if (a.tierRank !== b.tierRank) return a.tierRank - b.tierRank;
        const yearA = a.publication_year ?? 0;
        const yearB = b.publication_year ?? 0;
        return yearB - yearA;
      })
      .slice(0, limit);
  }

  /**
   * Renders a pristine, non-duplicate Markdown reference section from the canonical registry.
   */
  public renderCanonicalBibliography(limit = 10): string {
    const top = this.getTopRankedSources(limit);
    if (top.length === 0) return "### Sources & Literature References\n\n*No verified sources recorded.*";

    const lines = top.map((s, i) => {
      const yearStr = s.publication_year ? `${s.publication_year}` : s.yearOrId;
      const venueStr = s.venue ? ` — *${s.venue}*` : ` — *${s.source_tier.split(":")[0]}*`;
      const idTag = s.arxiv_id ? ` (arXiv:${s.arxiv_id})` : s.doi ? ` (DOI:${s.doi})` : "";
      const authorsStr = s.authors && s.authors.length > 0 && !s.authors.includes("Research Author(s)")
        ? ` — ${s.authors.slice(0, 3).join(", ")}${s.authors.length > 3 ? " et al." : ""}`
        : "";

      return `${i + 1}. [**${s.canonical_title}**](${s.canonical_url}) (${yearStr})${idTag}${venueStr}${authorsStr}`;
    });

    return `### Sources & Literature References\n\n${lines.join("\n")}`;
  }
}
