/**
 * @module infrastructure/embedding/cosine-similarity
 *
 * Float32Array 임베딩 간 코사인 유사도 계산 및 직렬화 유틸리티.
 */

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    normA += (a[i] ?? 0) ** 2;
    normB += (b[i] ?? 0) ** 2;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function serializeEmbedding(v: Float32Array): string {
  return JSON.stringify(Array.from(v));
}

export function deserializeEmbedding(s: string): Float32Array {
  return new Float32Array(JSON.parse(s) as number[]);
}
