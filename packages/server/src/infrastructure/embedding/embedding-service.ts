/**
 * @module infrastructure/embedding/embedding-service
 *
 * 워크플로우 라이브러리의 시맨틱 검색을 위한 로컬 임베딩 서비스.
 * @huggingface/transformers (Transformers.js)의 all-MiniLM-L6-v2 모델을 사용한다.
 * 모델 파일은 packages/server/models/ 에 포함되어 있어 완전 오프라인으로 동작한다.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline, env } from "@huggingface/transformers";
import type { FeatureExtractionPipeline } from "@huggingface/transformers";

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMS = 384;

const MODEL_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../models"
);

// 로컬 캐시만 사용 — 인터넷 연결 불필요
env.cacheDir = MODEL_DIR;
env.allowRemoteModels = false;

let _pipeline: FeatureExtractionPipeline | null = null;

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (!_pipeline) {
    // Transformers.js pipeline() 반환 타입이 복잡해 as-캐스팅으로 단순화
    _pipeline = (await pipeline("feature-extraction", EMBEDDING_MODEL, {
      dtype: "q8",
      device: "cpu",
    })) as unknown as FeatureExtractionPipeline;
  }
  return _pipeline;
}

export interface IEmbeddingService {
  embed(text: string): Promise<Float32Array>;
}

export class LocalEmbeddingService implements IEmbeddingService {
  async embed(text: string): Promise<Float32Array> {
    const extractor = await getPipeline();
    // 토큰 제한(256 word-pieces) 고려해 앞 512자만 사용
    const output = await extractor(text.slice(0, 512), { pooling: "mean", normalize: true });
    return new Float32Array(output.data as ArrayLike<number>);
  }
}

export function createEmbeddingService(): IEmbeddingService {
  return new LocalEmbeddingService();
}
