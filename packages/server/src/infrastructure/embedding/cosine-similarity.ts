/**
 * @module infrastructure/embedding/cosine-similarity
 *
 * Float32Array 임베딩 간 코사인 유사도 계산 및 직렬화 유틸리티.
 */

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < a.length; index += 1) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;
    dot += left * right;
    normA += left ** 2;
    normB += right ** 2;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

export function serializeEmbedding(value: Float32Array): string {
  return JSON.stringify(Array.from(value));
}

export function deserializeEmbedding(value: string): Float32Array {
  return new Float32Array(JSON.parse(value) as number[]);
}
