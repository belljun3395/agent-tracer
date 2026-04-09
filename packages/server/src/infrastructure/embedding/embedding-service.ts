import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env, pipeline } from "@huggingface/transformers";
import type { FeatureExtractionPipeline } from "@huggingface/transformers";
export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMS = 384;
function resolveModelDir(): string {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
        process.env["MONITOR_EMBEDDING_MODEL_DIR"],
        path.resolve(moduleDir, "../../../models"),
        path.resolve(moduleDir, "../models")
    ].filter((candidate): candidate is string => Boolean(candidate));
    const relativeTokenizerPath = path.join(EMBEDDING_MODEL, "tokenizer.json");
    const existingCandidate = candidates.find((candidate) => fs.existsSync(path.join(candidate, relativeTokenizerPath)));
    return existingCandidate ?? candidates[0] ?? path.resolve(moduleDir, "../../../models");
}
export const MODEL_DIR = resolveModelDir();
export function hasLocalEmbeddingModel(modelDir = MODEL_DIR): boolean {
    return fs.existsSync(path.join(modelDir, EMBEDDING_MODEL, "tokenizer.json"));
}
env.cacheDir = MODEL_DIR;
env.localModelPath = MODEL_DIR;
env.allowRemoteModels = false;
let extractorPipeline: FeatureExtractionPipeline | null = null;
async function getPipeline(): Promise<FeatureExtractionPipeline> {
    if (!extractorPipeline) {
        extractorPipeline = (await pipeline("feature-extraction", EMBEDDING_MODEL, {
            dtype: "q8",
            device: "cpu"
        })) as unknown as FeatureExtractionPipeline;
    }
    return extractorPipeline;
}
export interface IEmbeddingService {
    embed(text: string): Promise<Float32Array>;
}
export class LocalEmbeddingService implements IEmbeddingService {
    async embed(text: string): Promise<Float32Array> {
        const extractor = await getPipeline();
        const output = await extractor(text.slice(0, 512), {
            pooling: "mean",
            normalize: true
        });
        return new Float32Array(output.data as ArrayLike<number>);
    }
}
export function createEmbeddingService(): IEmbeddingService | undefined {
    if (!hasLocalEmbeddingModel()) {
        console.warn("[monitor-server] local embedding model not found; semantic workflow search disabled");
        return undefined;
    }
    return new LocalEmbeddingService();
}
