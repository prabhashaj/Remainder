import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export function getAiApiKey(): string | undefined {
  return (
    process.env["GEMINI_API_KEY"] ||
    process.env["GOOGLE_API_KEY"] ||
    process.env["OPENAI_API_KEY"] ||
    process.env["OPENROUTER_API_KEY"] ||
    process.env["AI_GATEWAY_API_KEY"] ||
    process.env["LOVABLE_API_KEY"]
  );
}

export function getAiModelName(defaultModel = "google/gemini-2.0-flash"): string {
  if (process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"]) {
    return process.env["GEMINI_MODEL"] || process.env["AI_MODEL"] || "gemini-2.0-flash";
  }
  if (process.env["OPENAI_API_KEY"] && !process.env["OPENROUTER_API_KEY"]) {
    return process.env["OPENAI_MODEL"] || "gpt-4o-mini";
  }
  return process.env["AI_MODEL"] || defaultModel;
}

/**
 * Uses the flagship, largest reasoning model specifically for deep multi-agent research.
 */
export function getResearchModelName(): string {
  if (process.env["RESEARCH_MODEL"]) {
    return process.env["RESEARCH_MODEL"];
  }
  if (process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"]) {
    return process.env["GEMINI_RESEARCH_MODEL"] || "gemini-2.0-flash";
  }
  if (process.env["OPENAI_API_KEY"] && !process.env["OPENROUTER_API_KEY"]) {
    return process.env["OPENAI_RESEARCH_MODEL"] || "gpt-4o-mini";
  }
  return "gemini-2.0-flash";
}

/**
 * Execute an AI function with exponential backoff on 429 Rate Limit errors.
 */
export async function withAiRateLimitRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; initialDelayMs?: number; label?: string } = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  let delayMs = options.initialDelayMs ?? 1500;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isRateLimit =
        errMsg.toLowerCase().includes("rate limit") ||
        errMsg.toLowerCase().includes("429") ||
        errMsg.toLowerCase().includes("quota") ||
        errMsg.toLowerCase().includes("too many requests") ||
        errMsg.toLowerCase().includes("resource_exhausted");

      if (isRateLimit && attempt < maxRetries) {
        console.warn(
          `[AI Gateway] ${options.label ?? "Call"} hit rate limit (attempt ${attempt}/${maxRetries}). Waiting ${delayMs}ms before retry...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2; // exponential backoff
        continue;
      }
      throw err;
    }
  }

  return fn();
}

export function createAiGatewayProvider(apiKey?: string) {
  const key = apiKey || getAiApiKey();
  if (!key) {
    throw new Error(
      "No AI API key configured. Please set GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, or AI_GATEWAY_API_KEY in your .env file.",
    );
  }

  // 1. Gemini / Google AI
  if (
    process.env["GEMINI_API_KEY"] ||
    process.env["GOOGLE_API_KEY"] ||
    key === process.env["GEMINI_API_KEY"] ||
    key === process.env["GOOGLE_API_KEY"]
  ) {
    return createGoogleGenerativeAI({
      apiKey: key,
    });
  }

  // 2. OpenRouter
  if (process.env["OPENROUTER_API_KEY"] || key === process.env["OPENROUTER_API_KEY"]) {
    return createOpenAICompatible({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
  }

  // 3. Custom AI Gateway
  if (process.env["AI_GATEWAY_BASE_URL"]) {
    return createOpenAICompatible({
      name: "custom-gateway",
      baseURL: process.env["AI_GATEWAY_BASE_URL"],
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
  }

  // 4. Lovable AI Gateway (Fallback if key provided)
  if (process.env["LOVABLE_API_KEY"] && key === process.env["LOVABLE_API_KEY"]) {
    return createOpenAICompatible({
      name: "lovable",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: {
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
    });
  }

  // 5. Default OpenAI
  return createOpenAICompatible({
    name: "openai",
    baseURL: process.env["OPENAI_BASE_URL"] || "https://api.openai.com/v1",
    headers: {
      Authorization: `Bearer ${key}`,
    },
  });
}
