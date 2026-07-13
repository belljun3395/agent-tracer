import { foldAttempt, type JobAttemptRecord } from "~ai-agent-worker/support/llm/job.attempt.js";
import type {
    TitleFailedAttempt,
    TitleJobSnapshot,
    TitleRepositoryPort,
    TitleSuggestionCommit,
    TitleTaskContext,
} from "../title.repository.port.js";

/** 제목 제안 저장 포트의 인메모리 대역이다. */
export class InMemoryTitleRepository implements TitleRepositoryPort {
    readonly settings = new Map<string, string>();
    readonly contexts = new Map<string, TitleTaskContext>();
    readonly failedAttempts: TitleFailedAttempt[] = [];
    readonly commits: TitleSuggestionCommit[] = [];
    readonly failures: { readonly jobId: string; readonly message: string }[] = [];
    started: string[] = [];
    startWins = true;
    commitWins = true;
    private job: TitleJobSnapshot | null = null;

    seedJob(job: TitleJobSnapshot): void {
        this.job = job;
    }

    findJob(jobId: string): Promise<TitleJobSnapshot | null> {
        return Promise.resolve(this.job !== null && this.job.id === jobId ? this.job : null);
    }

    startJob(jobId: string): Promise<boolean> {
        if (!this.startWins) return Promise.resolve(false);
        this.started.push(jobId);
        return Promise.resolve(true);
    }

    findTaskContext(_userId: string, taskId: string): Promise<TitleTaskContext | null> {
        return Promise.resolve(this.contexts.get(taskId) ?? null);
    }

    readSetting(key: string): Promise<string | null> {
        return Promise.resolve(this.settings.get(key) ?? null);
    }

    recordFailedAttempt(input: TitleFailedAttempt): Promise<void> {
        this.failedAttempts.push(input);
        return Promise.resolve();
    }

    foldSuccessAttempt(
        _jobId: string,
        record: JobAttemptRecord,
    ): Promise<{ readonly attempts: readonly JobAttemptRecord[] | undefined; readonly costUsd: number | null }> {
        const { attempts, totalCostUsd } = foldAttempt(this.job?.usage ?? {}, record);
        if (attempts.length <= 1) return Promise.resolve({ attempts: undefined, costUsd: record.costUsd });
        return Promise.resolve({ attempts, costUsd: totalCostUsd ?? record.costUsd });
    }

    commitSuggestions(input: TitleSuggestionCommit): Promise<{ readonly suggestionsCreated: number } | null> {
        if (!this.commitWins) return Promise.resolve(null);
        this.commits.push(input);
        return Promise.resolve({ suggestionsCreated: input.suggestions.length });
    }

    failJob(jobId: string, message: string): Promise<TitleJobSnapshot | null> {
        if (this.job === null || this.job.id !== jobId) return Promise.resolve(null);
        this.failures.push({ jobId, message });
        return Promise.resolve(this.job);
    }
}
