/** Mistral embeddings adapter for the GM Agent semantic retrieval layer. */
export type EmbeddingsClient = {
  embed(inputs: readonly string[], signal?: AbortSignal): Promise<number[][]>;
};

const unavailable = () =>
  Object.assign(new Error("embeddings_unavailable"), { code: "embeddings_unavailable" });
const invalid = () =>
  Object.assign(new Error("invalid_embedding_response"), { code: "invalid_embedding_response" });

/**
 * Corruption-layer client for the Mistral embeddings API, mirroring the chat
 * provider: fetch-based, fixed diagnostic error codes, and never exposing
 * upstream response bodies. The response must carry exactly one nonempty,
 * finite, dimension-homogeneous vector per input, in input order.
 */
export function createMistralEmbeddings(model: string, key: string): EmbeddingsClient {
  return {
    async embed(inputs, signal) {
      const response = await fetch("https://api.mistral.ai/v1/embeddings", {
        method: "POST",
        signal,
        redirect: "error",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: inputs }),
      }).catch(() => {
        throw unavailable();
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw unavailable();
      }
      const data = await response.json().catch(() => {
        throw invalid();
      });
      if (!Array.isArray(data?.data) || data.data.length !== inputs.length) throw invalid();
      const vectors: number[][] = [];
      for (const item of data.data) {
        const embedding = item?.embedding;
        if (
          !Array.isArray(embedding) ||
          !embedding.length ||
          embedding.some((value) => typeof value !== "number" || !Number.isFinite(value))
        )
          throw invalid();
        if (vectors.length && vectors[0]!.length !== embedding.length) throw invalid();
        vectors.push(embedding.slice());
      }
      return vectors;
    },
  };
}
