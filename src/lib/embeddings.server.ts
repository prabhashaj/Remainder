import { embedMany, embed } from "ai";
import { createAiGatewayProvider } from "./ai-gateway.server";

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  
  const provider = createAiGatewayProvider();
  // We use mistral-embed as the default, but this could be dynamically chosen
  const model = provider.textEmbeddingModel("mistral-embed");
  
  try {
    const { embeddings } = await embedMany({
      model,
      values: texts,
    });
    return embeddings;
  } catch (err) {
    console.error("Failed to generate embeddings:", err);
    throw new Error("Embedding generation failed");
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text.trim()) return [];
  
  const provider = createAiGatewayProvider();
  const model = provider.textEmbeddingModel("mistral-embed");
  
  try {
    const { embedding } = await embed({
      model,
      value: text,
    });
    return embedding;
  } catch (err) {
    console.error("Failed to generate embedding:", err);
    throw new Error("Embedding generation failed");
  }
}
