export interface IEmbeddingService {
    /** Identifier stored alongside persisted vectors so rows declare which model produced them. */
    readonly modelId: string;
    embed(text: string): Promise<Float32Array>;
}
