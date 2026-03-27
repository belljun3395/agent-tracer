/**
 * 임베딩 모델을 packages/server/models/ 에 다운로드한다.
 * 한 번만 실행하면 되며, 이후 서버는 완전 오프라인으로 동작한다.
 *
 * 사용법: node packages/server/scripts/download-model.mjs
 */
import { pipeline, env } from "@huggingface/transformers";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_DIR = path.resolve(__dirname, "../models");

env.cacheDir = MODEL_DIR;
env.allowRemoteModels = true;

console.log(`[download-model] Downloading all-MiniLM-L6-v2 → ${MODEL_DIR}`);

const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
  dtype: "q8",      // 8-bit 양자화 (~23MB)
  device: "cpu",
});

// 실제로 한 번 실행해서 모델 정상 여부 확인
const result = await extractor("warmup", { pooling: "mean", normalize: true });
console.log(`[download-model] OK — output dim: ${result.dims[1]}`);
console.log("[download-model] Done. Model cached at:", MODEL_DIR);
