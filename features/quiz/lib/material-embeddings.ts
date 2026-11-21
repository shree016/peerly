const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * Inputs per embeddings request. Chunks are ~900 chars (~225 tokens), so 96
 * inputs stay far below OpenAI's per-request input-count and token limits.
 */
const EMBEDDING_BATCH_SIZE = 96;
const MAX_ATTEMPTS = 4;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number) {
  return status === 429 || status >= 500;
}

async function embedBatch(
  texts: string[],
  model: string,
  apiKey: string,
): Promise<number[][]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, input: texts }),
      });
    } catch (error) {
      // Network failure — retry.
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_ATTEMPTS) await sleep(500 * 2 ** (attempt - 1));
      continue;
    }

    if (response.ok) {
      const data = (await response.json()) as {
        data?: Array<{ embedding: number[]; index: number }>;
      };
      // Order by `index` — OpenAI returns it, and we must not rely on array order.
      const rows = [...(data.data ?? [])].sort((a, b) => a.index - b.index);
      const embeddings = rows.map((row) => row.embedding);
      if (embeddings.length !== texts.length) {
        throw new Error("Embedding response size mismatch.");
      }
      return embeddings;
    }

    const errorBody = await response.text();
    lastError = new Error(
      `OpenAI embeddings failed (${response.status}): ${errorBody.slice(0, 300)}`,
    );

    if (!isRetryableStatus(response.status) || attempt === MAX_ATTEMPTS) {
      throw lastError;
    }

    const retryAfter = Number(response.headers.get("retry-after"));
    const delay =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 20_000)
        : 500 * 2 ** (attempt - 1);
    await sleep(delay);
  }

  throw lastError ?? new Error("OpenAI embeddings failed.");
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  if (texts.length === 0) return [];

  const model = process.env.OPENAI_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;

  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    embeddings.push(...(await embedBatch(batch, model, apiKey)));
  }
  return embeddings;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  if (!embedding) {
    throw new Error("Failed to embed query.");
  }
  return embedding;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return -1;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return -1;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
