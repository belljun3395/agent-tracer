import type { AiJobStepPayload, TitleSuggestionPayload } from "@monitor/kernel";
import { type AgentBackend, type AgentQueryUsage } from "@monitor/llm-runtime";
import type { OutputLanguage } from "~ai-agent-worker/support/output.language.js";
import type { TitleContext } from "~ai-agent-worker/domain/title/model/title.context.model.js";

export interface GenerateTitleSuggestionsInput {
    readonly jobId: string;
    readonly userId: string;
    readonly taskId: string;
    readonly language: OutputLanguage;
    readonly context: TitleContext;
    readonly apiKey?: string;
    readonly model?: string;
    readonly idempotencyKey?: string;
    readonly abortSignal?: AbortSignal;
}

export interface GenerateTitleSuggestionsOutput {
    readonly suggestions: readonly TitleSuggestionPayload[];
    readonly modelUsed: string;
    readonly durationMs: number;
    readonly costUsd: number | null;
    readonly numTurns: number | null;
    readonly usage: AgentQueryUsage | null;
    /** 모델과 도구 실행의 궤적이며 모든 백엔드가 채운다. */
    readonly steps: readonly AiJobStepPayload[];
}

/** 백엔드가 구현하는 제목 제안 생성 계약이다. */
export interface TitleAgentPort {
    requiresLocalApiKey(): boolean;
    generate(input: GenerateTitleSuggestionsInput): Promise<GenerateTitleSuggestionsOutput>;
}

export type TitleAgentRegistry = Readonly<Record<AgentBackend, TitleAgentPort>>;
