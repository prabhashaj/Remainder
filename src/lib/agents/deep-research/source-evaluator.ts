import type { SourceMetadata, SourceTier, SourceType } from "./types";
import { parseDateString } from "./scope-resolver";

const TIER_1_DOMAINS = new Set([
  // Frontier AI Labs & Companies (Official)
  "openai.com",
  "anthropic.com",
  "google.com",
  "ai.google",
  "deepmind.google",
  "meta.com",
  "ai.meta.com",
  "microsoft.com",
  "nvidia.com",
  "huggingface.co",
  "mistral.ai",
  "x.ai",
  "cohere.com",
  "apple.com",
  "amazon.science",
  "deepseek.com",
  "qwenlm.github.io",
  "alibabacloud.com",
  // Academic & Research Repositories
  "arxiv.org",
  "export.arxiv.org",
  "openreview.net",
  "nature.com",
  "science.org",
  "acm.org",
  "ieee.org",
  "aclanthology.org",
  "neurips.cc",
  "icml.cc",
  "iclr.cc",
  "cvpr.thecvf.com",
  "biorxiv.org",
  // Standards & Government
  "whitehouse.gov",
  "nist.gov",
  "europa.eu",
  "ai.gov",
  "w3.org",
  "iso.org",
]);

const TIER_2_DOMAINS = new Set([
  // Independent Benchmarking & Research Institutes
  "lmsys.org",
  "chat.lmsys.org",
  "paperswithcode.com",
  "semianalysis.com",
  "artificialanalysis.ai",
  "epoch.ai",
  "mlcommons.org",
  "stanford.edu",
  "mit.edu",
  "berkeley.edu",
  "cmu.edu",
  "ox.ac.uk",
  "cam.ac.uk",
  "technologyreview.com",
  "spectrum.ieee.org",
  "semanticscholar.org",
]);

const TIER_4_DOMAINS = new Set([
  // Social / Aggregators / Forums / SEO
  "reddit.com",
  "twitter.com",
  "x.com",
  "quora.com",
  "linkedin.com",
  "facebook.com",
  "youtube.com",
  "tiktok.com",
  "instagram.com",
  "pinterest.com",
  "threads.net",
]);

/**
 * Extracts the base hostname (e.g. "openai.com" from "https://openai.com/index/gpt-4/")
 */
export function extractDomain(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Extracts publication date from arXiv ID if applicable.
 * E.g. arXiv:2403.12345 -> Year 2024, Month 03 -> "2024-03-01"
 * E.g. arXiv:2610.12345 -> Year 2026, Month 10 -> "2026-10-01"
 */
export function extractDateFromArxivId(idOrUrl: string): string | undefined {
  const match = /(?:arxiv\.org\/(?:abs|pdf)\/|arXiv:)?(\d{2})(\d{2})\.\d+/i.exec(idOrUrl);
  if (match && match[1] && match[2]) {
    const yy = parseInt(match[1], 10);
    const mm = match[2];
    // 90-99 -> 1990-1999, 00-49 -> 2000-2049
    const yyyy = yy >= 90 ? 1900 + yy : 2000 + yy;
    return `${yyyy}-${mm}-01`;
  }
  return undefined;
}

/**
 * Extracts publication date from URL patterns like /2026/09/15/ or /2025-04-10/
 */
export function extractDateFromUrl(urlStr: string): string | undefined {
  // Pattern: /YYYY/MM/DD/
  const p1 = /\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//.exec(urlStr);
  if (p1 && p1[1] && p1[2] && p1[3]) {
    return `${p1[1]}-${p1[2].padStart(2, "0")}-${p1[3].padStart(2, "0")}`;
  }
  // Pattern: /YYYY/MM/
  const p2 = /\/(\d{4})\/(\d{1,2})\//.exec(urlStr);
  if (p2 && p2[1] && p2[2]) {
    return `${p2[1]}-${p2[2].padStart(2, "0")}-01`;
  }
  // Pattern: /YYYY-MM-DD
  const p3 = /[\/-](\d{4})-(\d{2})-(\d{2})/.exec(urlStr);
  if (p3 && p3[1] && p3[2] && p3[3]) {
    return `${p3[1]}-${p3[2]}-${p3[3]}`;
  }
  return undefined;
}

/**
 * Classifies the source into Tier 1, 2, 3, or 4 and assigns metadata.
 */
export function evaluateSource(params: {
  url: string;
  title: string;
  rawSnippet?: string | undefined;
  publishedDateHint?: string | undefined;
}): SourceMetadata {
  const domain = extractDomain(params.url);
  const lowerUrl = params.url.toLowerCase();
  const lowerTitle = params.title.toLowerCase();

  let sourceType: SourceType = "other";
  let sourceTier: SourceTier = 3;
  let primarySource = false;
  let publisher = domain;

  // 1. ArXiv & Academic Paper detection
  const arxivDate = extractDateFromArxivId(params.url) || extractDateFromArxivId(params.title);
  if (domain.includes("arxiv.org") || arxivDate) {
    sourceType = "paper";
    sourceTier = 1;
    primarySource = true;
    publisher = "arXiv";
  } else if (
    domain.endsWith(".gov") ||
    domain.endsWith(".europa.eu") ||
    TIER_1_DOMAINS.has(domain)
  ) {
    if (domain.endsWith(".gov") || domain.endsWith(".europa.eu")) {
      sourceType = "government";
    } else if (
      domain.includes("nature.com") ||
      domain.includes("science.org") ||
      domain.includes("openreview.net") ||
      domain.includes("acm.org") ||
      domain.includes("ieee.org")
    ) {
      sourceType = "paper";
    } else {
      sourceType = "official_company";
    }
    sourceTier = 1;
    primarySource = true;
  } else if (
    TIER_2_DOMAINS.has(domain) ||
    domain.endsWith(".edu") ||
    domain.endsWith(".ac.uk")
  ) {
    sourceType = "independent";
    sourceTier = 2;
    primarySource = false;
  } else if (
    TIER_4_DOMAINS.has(domain) ||
    lowerUrl.includes("forum") ||
    lowerUrl.includes("community")
  ) {
    sourceType = "social";
    sourceTier = 4;
    primarySource = false;
  } else {
    // Default general tech publications / blogs
    sourceType = "blog";
    sourceTier = 3;
    primarySource = false;
  }

  // Publication date resolution:
  // 1. Explicit publishedDateHint
  // 2. ArXiv ID date
  // 3. URL date patterns
  // 4. Fallback snippet scan
  let publicationDate: string | undefined = undefined;
  if (params.publishedDateHint) {
    publicationDate = parseDateString(params.publishedDateHint);
  }
  if (!publicationDate && arxivDate) {
    publicationDate = arxivDate;
  }
  if (!publicationDate) {
    publicationDate = extractDateFromUrl(params.url);
  }

  return {
    url: params.url,
    title: params.title,
    sourceType,
    sourceTier,
    publisher,
    publicationDate,
    primarySource,
    rawSnippet: params.rawSnippet,
  };
}

/**
 * Given two sources for the same claim, determines if Source A is strictly preferred over Source B
 * (e.g. Tier 1 primary company announcement beats Tier 3 tech blog).
 */
export function compareSourceQuality(a: SourceMetadata, b: SourceMetadata): number {
  // Lower tier number is higher quality: Tier 1 > Tier 2 > Tier 3 > Tier 4
  if (a.sourceTier !== b.sourceTier) {
    return a.sourceTier - b.sourceTier;
  }
  // If same tier, prefer primarySource: true
  if (a.primarySource && !b.primarySource) return -1;
  if (!a.primarySource && b.primarySource) return 1;
  return 0;
}
