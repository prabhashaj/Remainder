import type {
  DateStatus,
  SourceMetadata,
  SourceTier,
  SourceType,
  SupportDirectness,
} from "./types";
import { parseDateString } from "./scope-resolver";

/**
 * Extracts normalized hostname (e.g. "arxiv.org", "github.com", "nature.com")
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
 * Assigns an independence group to group syndicated PR releases, news wire echoes,
 * or subdomains belonging to the same corporate or media parent.
 * Prevents counting 10 articles echoing one press release as 10 independent confirmations.
 */
export function deriveIndependenceGroup(domain: string, title: string): string {
  const cleanDomain = domain.toLowerCase();

  // News wire syndications
  if (
    cleanDomain.includes("prnewswire") ||
    cleanDomain.includes("businesswire") ||
    cleanDomain.includes("globenewswire") ||
    cleanDomain.includes("accesswire")
  ) {
    return "syndicated_wire";
  }

  // Common media conglomerates / syndication
  if (cleanDomain.includes("reuters")) return "reuters_network";
  if (cleanDomain.includes("bloomberg")) return "bloomberg_network";
  if (cleanDomain.includes("apnews") || cleanDomain.includes("associatedpress")) return "ap_network";

  // Check if title contains explicit syndicated tags
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes("press release") || lowerTitle.includes("pr newswire")) {
    return "press_release_syndication";
  }

  // Base domain root (e.g. docs.aws.amazon.com -> amazon.com)
  const parts = cleanDomain.split(".");
  if (parts.length >= 2) {
    return parts.slice(-2).join(".");
  }

  return cleanDomain || "unknown_independence";
}

/**
 * Extracts publication date from URL patterns like /2024/05/12/ or /2025-09-15/
 */
export function extractDateFromUrl(urlStr: string): string | null {
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
  return null;
}

/**
 * Extracts date from arXiv ID (e.g. 2403.12345 -> 2024-03-01, 2609.12345 -> 2026-09-01)
 */
export function extractDateFromArxivId(idOrUrl: string): string | null {
  const match = /(?:arxiv\.org\/(?:abs|pdf)\/|arXiv:)?(\d{2})(\d{2})\.\d+/i.exec(idOrUrl);
  if (match && match[1] && match[2]) {
    const yy = parseInt(match[1], 10);
    const mm = match[2];
    const yyyy = yy >= 90 ? 1900 + yy : 2000 + yy;
    return `${yyyy}-${mm}-01`;
  }
  return null;
}

/**
 * Contextual Source Evaluator (Domain-Agnostic):
 * Evaluates authority, type, and tier based on institution type, peer-review status,
 * government authority, or official entity relationship.
 * Never invents a fake date if date is unknown.
 */
export function evaluateSource(params: {
  url: string;
  title: string;
  rawSnippet?: string | undefined;
  publishedDateHint?: string | undefined;
  targetEntities?: string[] | undefined;
}): SourceMetadata {
  const domain = extractDomain(params.url);
  const lowerUrl = params.url.toLowerCase();
  const lowerTitle = params.title.toLowerCase();

  let sourceType: SourceType = "other";
  let sourceTier: SourceTier = 3;
  let primarySource = false;
  let publisher = domain;

  // 1. Academic repositories & Peer-reviewed publishing
  const isAcademic =
    domain.includes("arxiv.org") ||
    domain.includes("doi.org") ||
    domain.includes("nature.com") ||
    domain.includes("science.org") ||
    domain.includes("cell.com") ||
    domain.includes("thelancet.com") ||
    domain.includes("ieee.org") ||
    domain.includes("acm.org") ||
    domain.includes("openreview.net") ||
    domain.includes("biorxiv.org") ||
    domain.includes("medrxiv.org") ||
    domain.includes("semanticscholar.org") ||
    domain.endsWith(".edu") ||
    domain.endsWith(".ac.uk");

  // 2. Government & Regulatory
  const isGovernment =
    domain.endsWith(".gov") ||
    domain.endsWith(".europa.eu") ||
    domain.endsWith(".gov.in") ||
    domain.endsWith(".gov.uk") ||
    domain.includes("who.int") ||
    domain.includes("un.org") ||
    domain.includes("oecd.org") ||
    domain.includes("worldbank.org") ||
    domain.includes("imf.org") ||
    domain.includes("iso.org") ||
    domain.includes("nist.gov");

  // 3. Independent Benchmarking / Audit Bodies
  const isIndependentBenchmark =
    domain.includes("lmsys.org") ||
    domain.includes("paperswithcode.com") ||
    domain.includes("epoch.ai") ||
    domain.includes("mlcommons.org") ||
    domain.includes("semianalysis.com");

  // 4. Social / Forums / Community aggregators
  const isSocialForum =
    domain.includes("reddit.com") ||
    domain.includes("twitter.com") ||
    domain.includes("x.com") ||
    domain.includes("quora.com") ||
    domain.includes("facebook.com") ||
    domain.includes("youtube.com") ||
    domain.includes("tiktok.com") ||
    lowerUrl.includes("/forum/") ||
    lowerUrl.includes("/community/");

  // 5. Official Entity Verification (Dynamic entity matching)
  let isEntityOfficial = false;
  const domainParts = domain.split(".");
  const domainRoot = domainParts[0]?.toLowerCase() || "";

  if (params.targetEntities && params.targetEntities.length > 0) {
    for (const ent of params.targetEntities) {
      const cleanEnt = ent.toLowerCase().replace(/[^a-z0-9]/g, "");
      const cleanDom = domain.replace(/[^a-z0-9]/g, "");
      if (cleanEnt.length >= 3 && cleanDom.includes(cleanEnt)) {
        isEntityOfficial = true;
        break;
      }
    }
  }

  // Domain root appears in title or official announcements path
  const isGenericBlogPlatform =
    domain.includes("medium.com") ||
    domain.includes("substack.com") ||
    domain.includes("wordpress.com") ||
    domain.includes("blogspot.com") ||
    domain.includes("tumblr.com") ||
    domain.includes("blogger.com") ||
    domain.includes("hashnode.dev") ||
    domain.includes("dev.to") ||
    domain.includes("rumor") ||
    domain.includes("leak");

  if (!isEntityOfficial && !isGenericBlogPlatform && !isSocialForum && domainRoot.length >= 3) {
    // Check if title or snippet mentions the entity domain name (e.g. OpenAI o1 on openai.com, DeepSeek on deepseek.com)
    const lowerSnippet = (params.rawSnippet || "").toLowerCase();
    const isDomainInText =
      new RegExp(`\\b${domainRoot}\\b`, "i").test(lowerTitle) ||
      new RegExp(`\\b${domainRoot}\\b`, "i").test(lowerSnippet);
    if (isDomainInText) {
      isEntityOfficial = true;
    }
  }

  // Classify hierarchy
  if (isGovernment) {
    sourceType = "government_regulatory";
    sourceTier = 1;
    primarySource = true;
  } else if (isAcademic) {
    sourceType = "academic_paper";
    sourceTier = 1;
    primarySource = true;
  } else if (isEntityOfficial) {
    sourceType = "official_company";
    sourceTier = 1;
    primarySource = true;
  } else if (isIndependentBenchmark) {
    sourceType = "independent_benchmark";
    sourceTier = 2;
    primarySource = false;
  } else if (isSocialForum) {
    sourceType = "forum_social";
    sourceTier = 4;
    primarySource = false;
  } else if (
    domain.includes("reuters.com") ||
    domain.includes("bloomberg.com") ||
    domain.includes("ft.com") ||
    domain.includes("wsj.com") ||
    domain.includes("nature.com") ||
    domain.includes("economist.com")
  ) {
    sourceType = "news_report";
    sourceTier = 2;
    primarySource = false;
  } else {
    sourceType = "blog";
    sourceTier = 3;
    primarySource = false;
  }

  // Publication date extraction: Strictly null if not found (Principle 1)
  let publicationDate: string | null = null;
  let dateStatus: DateStatus = "unknown";

  if (params.publishedDateHint) {
    const parsed = parseDateString(params.publishedDateHint);
    if (parsed) {
      publicationDate = parsed;
      dateStatus = "known";
    }
  }

  if (!publicationDate && domain.includes("arxiv.org")) {
    const arxivDate = extractDateFromArxivId(params.url) || extractDateFromArxivId(params.title);
    if (arxivDate) {
      publicationDate = arxivDate;
      dateStatus = "approximate";
    }
  }

  if (!publicationDate) {
    const urlDate = extractDateFromUrl(params.url);
    if (urlDate) {
      publicationDate = urlDate;
      dateStatus = "approximate";
    }
  }

  const independenceGroup = deriveIndependenceGroup(domain, params.title);

  // Dynamic Authority Score calculation
  let authorityScore = 5.0;
  if (sourceTier === 1) authorityScore = 9.5;
  else if (sourceTier === 2) authorityScore = 8.0;
  else if (sourceTier === 3) authorityScore = 5.5;
  else if (sourceTier === 4) authorityScore = 2.0;

  const id = `src_${Buffer.from(params.url).toString("base64url").slice(0, 12)}`;

  return {
    id,
    url: params.url,
    canonicalUrl: params.url.split("?")[0],
    title: params.title,
    publisher,
    publicationDate,
    dateStatus,
    sourceType,
    sourceTier,
    primarySource,
    independenceGroup,
    rawSnippet: params.rawSnippet,
    evaluation: {
      authority: authorityScore,
      directness: "DIRECT_SUPPORT",
      independence: sourceTier === 4 ? 2.0 : sourceTier === 1 && !isEntityOfficial ? 9.5 : 7.5,
      methodologicalQuality: sourceTier === 1 ? 9.0 : 6.0,
      recency: publicationDate ? 8.0 : 5.0,
      reproducibility: isAcademic || isGovernment ? 8.5 : 6.0,
    },
  };
}

/**
 * Source comparison preferring higher authority, independence, and primary status
 */
export function compareSourceQuality(a: SourceMetadata, b: SourceMetadata): number {
  if (a.sourceTier !== b.sourceTier) {
    return a.sourceTier - b.sourceTier; // Lower tier is better (Tier 1 > Tier 2)
  }
  const authA = a.evaluation?.authority || (5 - a.sourceTier);
  const authB = b.evaluation?.authority || (5 - b.sourceTier);
  if (authA !== authB) {
    return authB - authA; // Higher authority score is better
  }
  if (a.primarySource && !b.primarySource) return -1;
  if (!a.primarySource && b.primarySource) return 1;
  return 0;
}
