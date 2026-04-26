import type { TurnReceiptView } from "~domain/verification/index.js";
import { TurnNotFoundError } from "../errors.js";
import type { ILlmClient } from "./llm.port.js";
import { buildSummaryPrompt } from "./prompt.builder.js";

export interface GenerateTurnSummaryInput {
    readonly turnId: string;
    readonly force?: boolean;
}

export interface GenerateTurnSummaryOutput {
    readonly summaryMarkdown: string;
    readonly cached: boolean;
}

export interface ITurnSummaryRepository {
    getReceipt(turnId: string): Promise<TurnReceiptView | null>;
    getCachedSummary(turnId: string): Promise<string | null>;
    updateSummaryMarkdown(turnId: string, markdown: string): Promise<void>;
}

export interface GenerateTurnSummaryDeps {
    readonly repo: ITurnSummaryRepository;
    readonly llm: ILlmClient;
}

export class GenerateTurnSummaryUseCase {
    constructor(private readonly deps: GenerateTurnSummaryDeps) {}

    async getCachedSummary(turnId: string): Promise<string | null> {
        return this.deps.repo.getCachedSummary(turnId);
    }

    async execute(input: GenerateTurnSummaryInput): Promise<GenerateTurnSummaryOutput> {
        const { repo, llm } = this.deps;
        const receipt = await repo.getReceipt(input.turnId);
        if (!receipt) throw new TurnNotFoundError(input.turnId);

        if (!input.force) {
            const cached = await repo.getCachedSummary(input.turnId);
            if (cached) return { summaryMarkdown: cached, cached: true };
        }

        const result = await llm.complete({
            messages: buildSummaryPrompt(receipt),
            maxTokens: 600,
            temperature: 0.2,
        });
        await repo.updateSummaryMarkdown(input.turnId, result.text);
        return { summaryMarkdown: result.text, cached: false };
    }
}
