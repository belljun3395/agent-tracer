import type { TitleSuggestionPayload } from "@monitor/kernel";
import type { JobAttemptRecord } from "~ai-agent-worker/support/llm/job.attempt.js";
import type { GeneratedAiJobStep } from "~ai-agent-worker/support/llm/job.step.js";
import type { TitleContext } from "~ai-agent-worker/domain/title/model/title.context.model.js";

/** 잡의 실행 중 상태를 보는 최소 표현이다. */
export interface TitleJobSnapshot {
    readonly id: string;
    readonly userId: string;
    readonly taskId: string | null;
    readonly usage: Record<string, unknown>;
}

/** 제목 제안이 보는 태스크의 대화 컨텍스트다. */
export interface TitleTaskContext {
    readonly ownedByUser: boolean;
    readonly totalEventCount: number;
    readonly context: TitleContext | null;
}

export interface TitleFailedAttempt {
    readonly jobId: string;
    readonly userId: string;
    readonly steps: readonly GeneratedAiJobStep[];
    readonly record: JobAttemptRecord;
    readonly now: Date;
}

export interface TitleSuggestionCommit {
    readonly jobId: string;
    readonly userId: string;
    readonly suggestions: readonly TitleSuggestionPayload[];
    readonly steps: readonly GeneratedAiJobStep[];
    readonly attempt: number;
    readonly usage: Record<string, unknown>;
    readonly now: Date;
}

/** title 슬라이스가 원장과 읽기 모델에 요구하는 계약이다. */
export interface TitleRepositoryPort {
    findJob(jobId: string): Promise<TitleJobSnapshot | null>;
    startJob(jobId: string, now: Date): Promise<boolean>;
    findTaskContext(userId: string, taskId: string): Promise<TitleTaskContext | null>;
    readSetting(key: string): Promise<string | null>;
    recordFailedAttempt(input: TitleFailedAttempt): Promise<void>;
    foldSuccessAttempt(
        jobId: string,
        record: JobAttemptRecord,
    ): Promise<{ readonly attempts: readonly JobAttemptRecord[] | undefined; readonly costUsd: number | null }>;
    /** 잡 종결과 궤적 저장을 한 커밋으로 묶으며 경합에 지면 null을 낸다. */
    commitSuggestions(input: TitleSuggestionCommit): Promise<{ readonly suggestionsCreated: number } | null>;
    failJob(jobId: string, message: string, now: Date): Promise<TitleJobSnapshot | null>;
}
