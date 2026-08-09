import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createMistral } from "@ai-sdk/mistral";

export function getAiApiKey(): string | undefined {
  return (
    process.env["MISTRAL_API_KEY"] ||
    process.env["OPENAI_API_KEY"] ||
    process.env["OPENROUTER_API_KEY"] ||
    process.env["GEMINI_API_KEY"] ||
    process.env["GOOGLE_API_KEY"] ||
    process.env["AI_GATEWAY_API_KEY"] ||
    process.env["LOVABLE_API_KEY"]
  );
}

export function getAiModelName(defaultModel = "google/gemini-3.6-flash"): string {
  if (process.env["MISTRAL_API_KEY"]) {
    return process.env["MISTRAL_MODEL"] || "mistral-small-latest";
  }
  if (process.env["OPENAI_API_KEY"] && !process.env["OPENROUTER_API_KEY"]) {
    return process.env["OPENAI_MODEL"] || "gpt-4o-mini";
  }
  return process.env["AI_MODEL"] || defaultModel;
}

export function createAiGatewayProvider(apiKey?: string) {
  const key = apiKey || getAiApiKey();
  if (!key) {
    throw new Error(
      "No AI API key configured. Please set MISTRAL_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, or GEMINI_API_KEY in your .env file.",
    );
  }

  // 1. Mistral AI
  if (process.env["MISTRAL_API_KEY"] || key === process.env["MISTRAL_API_KEY"]) {
    return createMistral({
      apiKey: key,
      baseURL: process.env["MISTRAL_BASE_URL"] || "https://api.mistral.ai/v1",
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

  // 3. Gemini / Google AI
  if (
    process.env["GEMINI_API_KEY"] ||
    process.env["GOOGLE_API_KEY"] ||
    key === process.env["GEMINI_API_KEY"] ||
    key === process.env["GOOGLE_API_KEY"]
  ) {
    return createOpenAICompatible({
      name: "google",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
  }

  // 4. Custom AI Gateway
  if (process.env["AI_GATEWAY_BASE_URL"]) {
    return createOpenAICompatible({
      name: "custom-gateway",
      baseURL: process.env["AI_GATEWAY_BASE_URL"],
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
  }

  // 5. Lovable AI Gateway (Fallback if key provided)
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

  // 6. Default OpenAI
  return createOpenAICompatible({
    name: "openai",
    baseURL: process.env["OPENAI_BASE_URL"] || "https://api.openai.com/v1",
    headers: {
      Authorization: `Bearer ${key}`,
    },
  });
}

// Backwards compatibility alias
export const createLovableAiGatewayProvider = createAiGatewayProvider;
