import type { RecipeScanTrigger } from "@monitor/kernel";
import type { AgentUsageSummary } from "~ai-agent-worker/support/llm/job.attempt.js";
import type { GeneratedAiJobStep } from "~ai-agent-worker/support/llm/job.step.js";
import type { AgentBackend } from "~ai-agent-worker/support/llm/agent.backend.js";
import type { OutputLanguage } from "~ai-agent-worker/support/output.language.js";
import type { GeneratedRecipeCandidate } from "./recipe.candidate.model.js";

/** 워크플로가 넘기는 레시피 스캔 잡 입력이다. */
export interface RecipeScanInput {
    readonly jobId: string;
    readonly taskId: string;
    readonly userPrompt?: string;
    readonly language?: string;
    readonly trigger?: RecipeScanTrigger;
    readonly agentBackend?: string;
}

/** 준비와 생성과 종결 사이를 오가는 순수 데이터 계약이다. */
export interface RecipeScanPrep {
    readonly jobId: string;
    readonly userId: string;
    readonly taskId: string;
    readonly agentBackend: AgentBackend;
    readonly language: OutputLanguage;
    readonly userPrompt?: string;
    readonly model?: string;
}

/** 잡 실행 전체의 도구 순환 궤적과 조립된 후보를 함께 담는다. */
export interface RecipeScanGenerateOutput extends AgentUsageSummary {
    readonly recipes: readonly GeneratedRecipeCandidate[];
    readonly jobSteps: readonly GeneratedAiJobStep[];
}

export interface RecipeScanFinalizeInput {
    readonly jobId: string;
    readonly userId: string;
    readonly sourceTaskId: string;
    readonly language: OutputLanguage;
    readonly output: RecipeScanGenerateOutput;
}

export interface FailRecipeJobInput {
    readonly jobId: string;
    readonly message: string;
}
