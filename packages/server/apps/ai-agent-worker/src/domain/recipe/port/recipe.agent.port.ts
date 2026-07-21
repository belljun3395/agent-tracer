import type { AiJobStepPayload, RecipeCandidatePayload } from "@monitor/kernel";
import { type AgentBackend, type AgentQueryUsage } from "@monitor/llm-runtime";
import type { OutputLanguage } from "~ai-agent-worker/support/output.language.js";
import type { ProvenanceSnapshot } from "~ai-agent-worker/domain/recipe/model/recipe.provenance.model.js";

export interface GenerateRecipeCandidatesInput {
    readonly jobId: string;
    readonly userId: string;
    readonly taskId: string;
    readonly language: OutputLanguage;
    readonly apiKey?: string;
    readonly model?: string;
    readonly userPrompt?: string;
    readonly idempotencyKey?: string;
    readonly abortSignal?: AbortSignal;
}

export interface GenerateRecipeCandidatesOutput {
    readonly recipes: readonly RecipeCandidatePayload[];
    readonly modelUsed: string;
    readonly durationMs: number;
    readonly costUsd: number | null;
    readonly numTurns: number | null;
    readonly usage: AgentQueryUsage | null;
    /** 모델과 도구 실행의 궤적이며 모든 백엔드가 채운다. */
    readonly steps: readonly AiJobStepPayload[];
    /** 이 실행 중 도구가 실제로 돌려준 ID 장부다. */
    /** 워커가 도구를 돌렸을 때의 근거 장부이며, 실행 백엔드가 자기 장부로 검증했으면 null이다. */
    readonly provenance: ProvenanceSnapshot | null;
}

/** 백엔드가 구현하는 레시피 후보 생성 계약이다. */
export interface RecipeAgentPort {
    requiresLocalApiKey(): boolean;
    generate(input: GenerateRecipeCandidatesInput): Promise<GenerateRecipeCandidatesOutput>;
}

export type RecipeAgentRegistry = Readonly<Record<AgentBackend, RecipeAgentPort>>;
