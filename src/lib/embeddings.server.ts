import { embedMany, embed } from "ai";
import { createMistral } from "@ai-sdk/mistral";
import { createAiGatewayProvider } from "./ai-gateway.server";
import { log } from "./logger.server";

/**
 * Returns the correct embedding model name and provider for the active AI provider.
 * Mirrors the same env-var priority as getAiModelName() / createAiGatewayProvider().
 */
function getEmbeddingModel() {
  // 1. Mistral — native embedding support via @ai-sdk/mistral
  if (process.env["MISTRAL_API_KEY"]) {
    const provider = createMistral({
      apiKey: process.env["MISTRAL_API_KEY"],
      baseURL: process.env["MISTRAL_BASE_URL"] || "https://api.mistral.ai/v1",
    });
    return provider.textEmbeddingModel("mistral-embed");
  }

  const provider = createAiGatewayProvider();

  // 2. OpenAI (direct, not OpenRouter)
  if (process.env["OPENAI_API_KEY"] && !process.env["OPENROUTER_API_KEY"]) {
    return provider.textEmbeddingModel("text-embedding-3-small");
  }

  // 3. Gemini / Google AI
  if (process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"]) {
    return provider.textEmbeddingModel("text-embedding-004");
  }

  // 4. OpenRouter — route through mistral-embed on OR
  if (process.env["OPENROUTER_API_KEY"]) {
    return provider.textEmbeddingModel("mistral/mistral-embed");
  }

  // 5. Custom AI Gateway or Lovable — best-effort OpenAI-compatible embedding
  if (process.env["AI_GATEWAY_BASE_URL"] || process.env["LOVABLE_API_KEY"]) {
    log("warn", "embedding_provider_fallback", {
      note: "Using text-embedding-3-small as fallback — verify your gateway supports OpenAI embedding API",
    });
    return provider.textEmbeddingModel("text-embedding-3-small");
  }

  // 6. Default OpenAI fallback
  return provider.textEmbeddingModel("text-embedding-3-small");
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const model = getEmbeddingModel();

  try {
    const { embeddings } = await embedMany({
      model,
      values: texts,
    });
    return embeddings;
  } catch (err) {
    log("error", "generate_embeddings_failed", {
      error: err instanceof Error ? err.message : String(err),
      provider: process.env["MISTRAL_API_KEY"]
        ? "mistral"
        : process.env["OPENAI_API_KEY"]
          ? "openai"
          : process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"]
            ? "gemini"
            : process.env["OPENROUTER_API_KEY"]
              ? "openrouter"
              : "unknown",
    });
    throw new Error("Embedding generation failed");
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text.trim()) return [];

  const model = getEmbeddingModel();

  try {
    const { embedding } = await embed({
      model,
      value: text,
    });
    return embedding;
  } catch (err) {
    log("error", "generate_embedding_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw new Error("Embedding generation failed");
  }
}
