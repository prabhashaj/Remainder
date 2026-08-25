/**
 * Source Quality Ranking & Primary Source Hierarchy (Tier 1 - Tier 6)
 * Remispace Deep Research Agent
 */

import type { ResearchSource, SourceTier } from "./types";
import { extractDomain } from "@/lib/tavily.server";

// Prestigious Peer-Reviewed AI/CS/Science Venues (Tier 1)
const PEER_REVIEWED_VENUES = new Set([
  "neurips", "nips", "icml", "iclr", "acl", "emnlp", "naacl", "eacl", "coling",
  "cvpr", "iccv", "eccv", "kdd", "sigir", "aaai", "ijcai", "sigmod", "vldb",
  "osdi", "sosp", "usenix", "pldi", "popl", "asplos", "isca", "micro",
  "ieee", "acm", "nature", "science", "cell", "lancet", "pnas", "jmlr",
  "tacl", "tpami", "ijcv", "pami", "springer", "elsevier", "wiley",
]);

// Official Premier AI & Scientific Research Labs (Tier 2)
const PREMIER_RESEARCH_DOMAINS = new Set([
  "deepmind.google", "research.google", "openai.com", "research.facebook.com",
  "ai.meta.com", "microsoft.com/research", "bair.berkeley.edu", "csail.mit.edu",
  "stanford.edu", "cmu.edu", "ox.ac.uk", "cam.ac.uk", "ethz.ch", "epfl.ch",
  "inria.fr", "allenai.org", "eleuther.ai", "huggingface.co/papers",
]);

// Official Engineering Docs & Benchmark Repositories (Tier 3)
const TECH_DOCS_AND_BENCHMARKS = new Set([
  "paperswithcode.com", "mlcommons.org", "w3.org", "rfc-editor.org", "ietf.org",
  "nist.gov", "iso.org", "docs.python.org", "pytorch.org/docs", "tensorflow.org",
  "github.com", "huggingface.co/docs",
]);

// Community Forums & Aggregators (Tier 6)
const COMMUNITY_FORUMS = new Set([
  "reddit.com", "quora.com", "medium.com", "towardsdatascience.com", "hackernoon.com",
  "dev.to", "substack.com", "youtube.com", "twitter.com", "x.com", "facebook.com",
]);

/**
 * Classifies a raw source into the 6-Tier Hierarchy.
 */
export function classifySourceTier(source: {
  title: string;
  url: string;
  venue?: string | undefined;
  type?: string | undefined;
  abstractOrContent?: string | undefined;
}): { tier: SourceTier; rank: number; isPrimary: boolean } {
  const urlLower = (source.url || "").toLowerCase();
  const domain = extractDomain(urlLower);
  const venueLower = (source.venue || "").toLowerCase();
  const titleLower = (source.title || "").toLowerCase();
  const typeLower = (source.type || "").toLowerCase();

  // Tier 1: Peer-Reviewed Conference / Journal / Official Standard
  const hasPeerReviewedVenue = Array.from(PEER_REVIEWED_VENUES).some(
    (v) => venueLower.includes(v) || titleLower.includes(`proceedings of ${v}`),
  );
  const isStandardsBody = urlLower.includes("w3.org") || urlLower.includes("rfc-editor.org") || urlLower.includes("nist.gov") || urlLower.includes("iso.org");
  if (hasPeerReviewedVenue || isStandardsBody) {
    return {
      tier: "Tier 1: Peer-Reviewed Journal / Top Conference",
      rank: 1,
      isPrimary: true,
    };
  }

  // Tier 2: arXiv Preprint / Official Research Lab Publication
  const isArxiv = urlLower.includes("arxiv.org") || typeLower.includes("arxiv") || /^arxiv:/i.test(source.venue || "");
  const isPremierLab = Array.from(PREMIER_RESEARCH_DOMAINS).some((d) => domain.includes(d) || urlLower.includes(d));
  if (isArxiv || isPremierLab) {
    return {
      tier: "Tier 2: arXiv Preprint / Official Lab Publication",
      rank: 2,
      isPrimary: true,
    };
  }

  // Tier 4: Systematic Surveys / Meta-Analyses (check title keywords)
  const isSurvey = titleLower.includes("survey") || titleLower.includes("a comprehensive review") || titleLower.includes("systematic review") || titleLower.includes("meta-analysis") || titleLower.includes("taxonomy and review");
  if (isSurvey && (isArxiv || urlLower.includes("semanticscholar.org") || urlLower.includes("doi.org"))) {
    return {
      tier: "Tier 4: Academic Survey / Systematic Review",
      rank: 4,
      isPrimary: false,
    };
  }

  // Tier 3: Technical Report / Official Framework Documentation / Benchmark Repository
  const isOfficialDocOrBenchmark = Array.from(TECH_DOCS_AND_BENCHMARKS).some((d) => domain.includes(d) || urlLower.includes(d));
  if (isOfficialDocOrBenchmark || typeLower.includes("doc") || typeLower.includes("technical report")) {
    return {
      tier: "Tier 3: Technical Report / Official Documentation",
      rank: 3,
      isPrimary: true,
    };
  }

  // Tier 6: Community Forums / Aggregators / Social
  const isCommunityForum = Array.from(COMMUNITY_FORUMS).some((f) => domain.includes(f) || urlLower.includes(f));
  if (isCommunityForum) {
    return {
      tier: "Tier 6: General Web / Community Forum",
      rank: 6,
      isPrimary: false,
    };
  }

  // Tier 5: Industry / Engineering Blogs / Verified Technical Articles
  if (domain.includes("blog") || urlLower.includes("/blog/") || urlLower.includes("/engineering/")) {
    return {
      tier: "Tier 5: Industry / Engineering Blog",
      rank: 5,
      isPrimary: false,
    };
  }

  // Default Web Source
  return {
    tier: "Tier 5: Industry / Engineering Blog",
    rank: 5,
    isPrimary: false,
  };
}

/**
 * Normalizes, deduplicates, and ranks raw research sources.
 */
export function rankAndFilterSources(
  rawSources: Array<{
    title: string;
    url: string;
    authors?: string[];
    year?: number;
    yearOrId?: string;
    venue?: string;
    type?: string;
    content?: string;
    citationCount?: number;
  }>,
  topic: string,
): ResearchSource[] {
  const seenUrls = new Set<string>();
  const normalizedSources: ResearchSource[] = [];

  const topicKeywords = topic
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((k) => k.length >= 3 && !["about", "what", "when", "explain", "research", "study"].includes(k));

  for (let i = 0; i < rawSources.length; i++) {
    const raw = rawSources[i]!;
    const cleanUrl = raw.url?.trim();
    if (!cleanUrl || seenUrls.has(cleanUrl)) continue;
    seenUrls.add(cleanUrl);

    const classification = classifySourceTier({
      title: raw.title,
      url: cleanUrl,
      venue: raw.venue,
      type: raw.type,
      abstractOrContent: raw.content,
    });

    const id = `src_${normalizedSources.length + 1}`;
    const year = raw.year || (raw.yearOrId ? parseInt(raw.yearOrId, 10) : undefined);

    normalizedSources.push({
      id,
      title: raw.title.trim() || "Untitled Source",
      url: cleanUrl,
      authors: raw.authors && raw.authors.length > 0 ? raw.authors : ["Research Author(s)"],
      year: isNaN(year!) ? undefined : year,
      yearOrId: raw.yearOrId || (year ? String(year) : "Recent"),
      venue: raw.venue,
      type: raw.type || classification.tier.split(":")[0]!,
      tier: classification.tier,
      tierRank: classification.rank,
      abstractOrSnippet: raw.content || "",
      citationCount: raw.citationCount,
      isPrimarySource: classification.isPrimary,
    });
  }

  // Sort by Tier Rank (1 = highest), then year (descending), then topical relevance
  return normalizedSources.sort((a, b) => {
    // 1. Tier hierarchy (Tier 1 & Tier 2 first)
    if (a.tierRank !== b.tierRank) {
      return a.tierRank - b.tierRank;
    }

    // 2. Topical keyword density in title
    const aMatches = topicKeywords.filter((k) => a.title.toLowerCase().includes(k)).length;
    const bMatches = topicKeywords.filter((k) => b.title.toLowerCase().includes(k)).length;
    if (aMatches !== bMatches) {
      return bMatches - aMatches;
    }

    // 3. Year (newer first)
    const aYear = a.year ?? 0;
    const bYear = b.year ?? 0;
    return bYear - aYear;
  });
}
