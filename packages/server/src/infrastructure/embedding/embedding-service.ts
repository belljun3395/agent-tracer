/**
 * @module infrastructure/embedding/embedding-service
 *
 * 워크플로우 라이브러리의 시맨틱 검색을 위한 임베딩 서비스.
 * Voyage AI API (voyage-3-lite, 512차원)를 사용한다.
 * VOYAGE_API_KEY 환경변수가 없으면 null을 반환해 LIKE 검색으로 폴백한다.
 */

export const EMBEDDING_MODEL = "voyage-3-lite";
export const EMBEDDING_DIMS = 512;

export interface IEmbeddingService {
  embed(text: string, inputType?: "document" | "query"): Promise<Float32Array>;
}

interface VoyageEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

export class VoyageEmbeddingService implements IEmbeddingService {
  private readonly apiKey: string;
  private readonly endpoint = "https://api.voyageai.com/v1/embeddings";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embed(text: string, inputType: "document" | "query" = "document"): Promise<Float32Array> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: [text],
        input_type: inputType,
      }),
    });

    if (!response.ok) {
      throw new Error(`Voyage AI embedding error: ${response.status} ${await response.text()}`);
    }

    const json = await response.json() as VoyageEmbeddingResponse;
    const embedding = json.data[0]?.embedding;
    if (!embedding) throw new Error("Voyage AI returned empty embedding");

    return new Float32Array(embedding);
  }
}

export function createEmbeddingService(): IEmbeddingService | null {
  const key = process.env["VOYAGE_API_KEY"];
  if (!key) {
    console.log("[monitor-server] No VOYAGE_API_KEY — semantic search disabled, using LIKE fallback");
    return null;
  }
  return new VoyageEmbeddingService(key);
}
