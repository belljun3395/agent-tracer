import type { AiJobStepPayload, CleanupSuggestionPayload } from "@monitor/kernel";
import type { AgentBackend } from "~ai-agent-worker/support/llm/agent.backend.js";
import type { AgentQueryUsage } from "~ai-agent-worker/support/llm/agent.usage.js";
import type { OutputLanguage } from "~ai-agent-worker/support/output.language.js";
import type { CleanupCandidate } from "~ai-agent-worker/domain/cleanup/model/cleanup.candidate.model.js";

export interface GenerateCleanupSuggestionsInput {
    readonly jobId: string;
    readonly userId: string;
    readonly language: OutputLanguage;
    /** stale 판단의 기준이 되는 이번 스캔의 기준 시각이다. */
    readonly scannedAt: string;
    readonly candidates: readonly CleanupCandidate[];
    /** 서버 조회가 상한에 걸려 이 배치가 후보 전체를 담지 못했는지 여부다. */
    readonly truncated: boolean;
    readonly maxSuggestions: number;
    readonly apiKey?: string;
    readonly model?: string;
    readonly idempotencyKey?: string;
    readonly abortSignal?: AbortSignal;
}

export interface GenerateCleanupSuggestionsOutput {
    readonly suggestions: readonly CleanupSuggestionPayload[];
    readonly modelUsed: string;
    readonly durationMs: number;
    readonly costUsd: number | null;
    readonly numTurns: number | null;
    readonly usage: AgentQueryUsage | null;
    /** 모델과 도구 실행의 궤적이며 모든 백엔드가 채운다. */
    readonly steps: readonly AiJobStepPayload[];
}

/** 백엔드가 구현하는 태스크 정리 제안 생성 계약이다. */
export interface CleanupAgentPort {
    requiresLocalApiKey(): boolean;
    generate(input: GenerateCleanupSuggestionsInput): Promise<GenerateCleanupSuggestionsOutput>;
}

export type CleanupAgentRegistry = Readonly<Record<AgentBackend, CleanupAgentPort>>;
