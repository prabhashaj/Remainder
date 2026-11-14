import { embedMany, embed } from "ai";
import { createAiGatewayProvider } from "./ai-gateway.server";
import { log } from "./logger.server";

/**
 * Returns the correct embedding model name and provider for the active AI provider.
 * Mirrors the same env-var priority as getAiModelName() / createAiGatewayProvider().
 */
function getEmbeddingModel() {
  const provider = createAiGatewayProvider();

  // 1. Gemini / Google AI
  if (process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"]) {
    return provider.textEmbeddingModel("gemini-embedding-001");
  }

  // 2. OpenAI (direct, not OpenRouter)
  if (process.env["OPENAI_API_KEY"] && !process.env["OPENROUTER_API_KEY"]) {
    return provider.textEmbeddingModel("text-embedding-3-small");
  }

  // 3. OpenRouter
  if (process.env["OPENROUTER_API_KEY"]) {
    return provider.textEmbeddingModel("text-embedding-3-small");
  }

  // 4. Custom AI Gateway or Lovable — best-effort OpenAI-compatible embedding
  if (process.env["AI_GATEWAY_BASE_URL"] || process.env["LOVABLE_API_KEY"]) {
    log("warn", "embedding_provider_fallback", {
      note: "Using text-embedding-3-small as fallback — verify your gateway supports OpenAI embedding API",
    });
    return provider.textEmbeddingModel("text-embedding-3-small");
  }

  // 5. Default OpenAI fallback
  return provider.textEmbeddingModel("text-embedding-3-small");
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const model = getEmbeddingModel();
  const providerOptions =
    process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"]
      ? { google: { outputDimensionality: 1024 } }
      : undefined;

  try {
    const { embeddings } = await embedMany({
      model,
      values: texts,
      ...(providerOptions ? { providerOptions } : {}),
    });
    return embeddings;
  } catch (err) {
    log("error", "generate_embeddings_failed", {
      error: err instanceof Error ? err.message : String(err),
      provider: process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"]
        ? "gemini"
        : process.env["OPENAI_API_KEY"]
          ? "openai"
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
  const providerOptions =
    process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"]
      ? { google: { outputDimensionality: 1024 } }
      : undefined;

  try {
    const { embedding } = await embed({
      model,
      value: text,
      ...(providerOptions ? { providerOptions } : {}),
    });
    return embedding;
  } catch (err) {
    log("error", "generate_embedding_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw new Error("Embedding generation failed");
  }
}
