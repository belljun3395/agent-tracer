import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Logger } from "@nestjs/common";

const logger = new Logger("EmbeddingService");

/**
 * Loosely-typed handle to the HuggingFace pipeline. We avoid importing the
 * real type so `@huggingface/transformers` can live in optionalDependencies —
 * `npm install --omit=optional` (or any user who opts out of the embedding
 * feature) won't break type checking.
 */
type FeatureExtractionPipelineLike = (
    text: string,
    options: { pooling: "mean"; normalize: boolean },
) => Promise<{ data: ArrayLike<number> }>;

/** Self-contained embedding service contract — local to event module. */
export interface IEmbeddingService {
    /** Identifier stored alongside persisted vectors so rows declare which model produced them. */
    readonly modelId: string;
    embed(text: string): Promise<Float32Array>;
}

const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
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
const MODEL_DIR = resolveModelDir();
function hasLocalEmbeddingModel(modelDir = MODEL_DIR): boolean {
    return fs.existsSync(path.join(modelDir, EMBEDDING_MODEL, "tokenizer.json"));
}

let extractorPipeline: FeatureExtractionPipelineLike | null = null;
interface TransformersModuleLike {
    readonly env: { cacheDir: string; localModelPath: string; allowRemoteModels: boolean };
    pipeline: (
        task: string,
        model: string,
        options: { dtype: string; device: string },
    ) => Promise<unknown>;
}

async function loadTransformers(): Promise<TransformersModuleLike> {
    const module = await (import("@huggingface/transformers") as unknown as Promise<TransformersModuleLike>);
    module.env.cacheDir = MODEL_DIR;
    module.env.localModelPath = MODEL_DIR;
    module.env.allowRemoteModels = false;
    return module;
}

let transformersModulePromise: Promise<TransformersModuleLike> | null = null;

async function getTransformers(): Promise<TransformersModuleLike> {
    if (!transformersModulePromise) {
        transformersModulePromise = loadTransformers();
    }
    return transformersModulePromise;
}

async function getPipeline(): Promise<FeatureExtractionPipelineLike> {
    if (!extractorPipeline) {
        const { pipeline } = await getTransformers();
        extractorPipeline = (await pipeline("feature-extraction", EMBEDDING_MODEL, {
            dtype: "q8",
            device: "cpu",
        })) as FeatureExtractionPipelineLike;
    }
    return extractorPipeline;
}
class LocalEmbeddingService implements IEmbeddingService {
    readonly modelId: string = EMBEDDING_MODEL;
    async embed(text: string): Promise<Float32Array> {
        const extractor = await getPipeline();
        const output = await extractor(text.slice(0, 512), {
            pooling: "mean",
            normalize: true
        });
        return new Float32Array(output.data);
    }
}
export function createEmbeddingService(): IEmbeddingService | undefined {
    if (!hasLocalEmbeddingModel()) {
        logger.warn("local embedding model not found; semantic workflow search disabled");
        return undefined;
    }
    return new LocalEmbeddingService();
}
