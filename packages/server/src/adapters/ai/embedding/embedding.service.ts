import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IEmbeddingService } from "~application/ports/service/embedding.service.js";

import type { FeatureExtractionPipeline } from "@huggingface/transformers";
export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMS = 384;
function resolveModelDir(): string {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
        process.env["MONITOR_EMBEDDING_MODEL_DIR"],
        path.resolve(moduleDir, "../../models"),
        path.resolve(moduleDir, "../models")
    ].filter((candidate): candidate is string => Boolean(candidate));
    const relativeTokenizerPath = path.join(EMBEDDING_MODEL, "tokenizer.json");
    const existingCandidate = candidates.find((candidate) => fs.existsSync(path.join(candidate, relativeTokenizerPath)));
    return existingCandidate ?? candidates[0] ?? path.resolve(moduleDir, "../../models");
}
export const MODEL_DIR = resolveModelDir();
export function hasLocalEmbeddingModel(modelDir = MODEL_DIR): boolean {
    return fs.existsSync(path.join(modelDir, EMBEDDING_MODEL, "tokenizer.json"));
}

let extractorPipeline: FeatureExtractionPipeline | null = null;
async function loadTransformers() {
    const module = await import("@huggingface/transformers");
    module.env.cacheDir = MODEL_DIR;
    module.env.localModelPath = MODEL_DIR;
    module.env.allowRemoteModels = false;
    return module;
}

let transformersModulePromise: ReturnType<typeof loadTransformers> | null = null;

async function getTransformers() {
    if (!transformersModulePromise) {
        transformersModulePromise = loadTransformers();
    }
    return transformersModulePromise;
}

async function getPipeline(): Promise<FeatureExtractionPipeline> {
    if (!extractorPipeline) {
        const { pipeline } = await getTransformers();
        extractorPipeline = (await pipeline("feature-extraction", EMBEDDING_MODEL, {
            dtype: "q8",
            device: "cpu"
        })) as unknown as FeatureExtractionPipeline;
    }
    return extractorPipeline;
}
export class LocalEmbeddingService implements IEmbeddingService {
    readonly modelId: string = EMBEDDING_MODEL;
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
