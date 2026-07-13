import type { AgentBackend } from "~ai-agent-worker/support/llm/agent.backend.js";
import type { AgentUsageSummary } from "~ai-agent-worker/support/llm/job.attempt.js";
import type { GeneratedAiJobStep } from "~ai-agent-worker/support/llm/job.step.js";
import type { OutputLanguage } from "~ai-agent-worker/support/output.language.js";
import type { CleanupCandidate } from "./cleanup.candidate.model.js";
import type { GeneratedCleanupSuggestion } from "./cleanup.suggestion.model.js";

/** 워크플로가 넘기는 태스크 정리 잡 입력이다. */
export interface TaskCleanupInput {
    readonly jobId: string;
    readonly maxSuggestions?: number;
    readonly agentBackend?: string;
}

/** 준비와 생성과 종결 사이를 오가는 순수 데이터 계약이다. */
export interface TaskCleanupPrep {
    readonly jobId: string;
    readonly userId: string;
    readonly agentBackend: AgentBackend;
    readonly language: OutputLanguage;
    readonly maxSuggestions: number;
    readonly candidates: readonly CleanupCandidate[];
    readonly truncated: boolean;
    readonly tasksScanned: number;
    readonly model?: string;
}

/** 잡 실행 전체의 도구 순환 궤적과 조립된 제안을 함께 담는다. */
export interface TaskCleanupGenerateOutput extends AgentUsageSummary {
    readonly suggestions: readonly GeneratedCleanupSuggestion[];
    readonly jobSteps: readonly GeneratedAiJobStep[];
}

export interface TaskCleanupFinalizeInput {
    readonly jobId: string;
    readonly userId: string;
    readonly tasksScanned: number;
    /** 후보 태스크가 없어 언어 모델 호출을 생략했으면 null이다. */
    readonly output: TaskCleanupGenerateOutput | null;
}

export interface FailCleanupJobInput {
    readonly jobId: string;
    readonly message: string;
}
