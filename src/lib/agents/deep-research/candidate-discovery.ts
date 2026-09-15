import type { ResearchScope } from "./types";

export interface LandscapeCandidate {
  id: string;
  name: string;
  domain: string;
  subdomain: string;
  searchQueries: {
    academic: string;
    web: string;
  };
}

export const AI_LANDSCAPE_DOMAINS: Record<string, string[]> = {
  "Model Architectures": [
    "Test-time compute & reasoning models (o1, o3, R1)",
    "Mixture-of-Experts (MoE) scaling and sparse routing",
    "Long-context retrieval and 1M+ token attention mechanisms",
    "Diffusion-based language models and hybrid architectures",
    "Open-weight frontier model architectures (Llama 3, DeepSeek, Qwen)",
  ],
  Agents: [
    "Autonomous coding agents and repository-level engineering (SWE-bench)",
    "Computer-use and OS interaction agents (GUI grounded action)",
    "Multi-agent coordination, orchestration, and planning protocols",
    "Self-directed tool use, memory systems, and environment feedback loops",
  ],
  "Generative AI & Multimodal": [
    "Generative video and physical world simulators (Sora, Kling, Gen-3)",
    "Omni-modal voice, audio, and visual real-time interaction",
    "Native multimodal reasoning across interleaved text, vision, and audio",
  ],
  "Robotics & Embodied AI": [
    "Vision-Language-Action (VLA) foundation models for manipulation",
    "Humanoid robotics control policies and sim-to-real transfer",
  ],
  "Infrastructure & Hardware": [
    "Next-gen GPU architectures (Blackwell B200) and optical interconnects",
    "Custom AI ASICs (Google TPU v5p/v6e, AWS Trainium/Inferentia)",
    "Inference optimization (FP4/FP8 quantization, KV-cache compression, speculative decoding)",
  ],
  "Training & Post-Training": [
    "Reinforcement Learning with Verifiable Rewards (RLVR) and reasoning training",
    "Synthetic data curation, filtering pipelines, and model-in-the-loop self-play",
    "Direct Preference Optimization (DPO) and process reward models (PRMs)",
  ],
  "Safety & Alignment": [
    "Automated red-teaming, jailbreak resistance, and evaluation benchmarks",
    "Mechanistic interpretability of frontier reasoning models",
    "Agent containment, permission boundaries, and safety guardrails",
  ],
  "Regulation & Governance": [
    "EU AI Act implementation and enforcement milestones",
    "US AI safety standards, executive orders, and national security frameworks",
  ],
  "Commercialization & Industry Adoption": [
    "API economics, enterprise agent deployments, and token price deflation",
    "Production coding assistants and developer productivity transformation",
  ],
};

/**
 * Builds a broad candidate list across landscape domains for the research scope.
 * Prevents search bias by ensuring all technical domains are represented.
 */
export function generateLandscapeCandidates(scope: ResearchScope): LandscapeCandidate[] {
  const candidates: LandscapeCandidate[] = [];
  let candidateIndex = 1;

  const domainsToCover =
    scope.domains.length > 0 ? scope.domains : Object.keys(AI_LANDSCAPE_DOMAINS);

  for (const domain of domainsToCover) {
    const subdomains = AI_LANDSCAPE_DOMAINS[domain] || [domain];

    for (const subdomain of subdomains) {
      const id = `cand_${candidateIndex++}`;
      const yearConstraint = scope.endDate
        ? scope.endDate.slice(0, 4)
        : new Date().getFullYear().toString();

      candidates.push({
        id,
        name: subdomain.split("(")[0]?.trim() || subdomain,
        domain,
        subdomain,
        searchQueries: {
          academic: `${subdomain} state of the art benchmarks`,
          web: `${subdomain} breakthroughs developments ${yearConstraint}`,
        },
      });
    }
  }

  return candidates;
}
