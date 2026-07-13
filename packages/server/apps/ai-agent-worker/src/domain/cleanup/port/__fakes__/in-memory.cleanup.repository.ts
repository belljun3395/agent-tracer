import { foldAttempt, type JobAttemptRecord } from "~ai-agent-worker/support/llm/job.attempt.js";
import type {
    CleanupCommit,
    CleanupFailedAttempt,
    CleanupJobSnapshot,
    CleanupRepositoryPort,
    CleanupScanBatch,
} from "../cleanup.repository.port.js";

const EMPTY_BATCH: CleanupScanBatch = {
    tasks: [],
    activeChildParentIds: [],
    truncated: false,
    tasksScanned: 0,
};

/** 정리 제안 저장 포트의 인메모리 대역이다. */
export class InMemoryCleanupRepository implements CleanupRepositoryPort {
    readonly settings = new Map<string, string>();
    readonly failedAttempts: CleanupFailedAttempt[] = [];
    readonly commits: CleanupCommit[] = [];
    readonly failures: { readonly jobId: string; readonly message: string }[] = [];
    started: string[] = [];
    startWins = true;
    commitWins = true;
    batch: CleanupScanBatch = EMPTY_BATCH;
    private job: CleanupJobSnapshot | null = null;

    seedJob(job: CleanupJobSnapshot): void {
        this.job = job;
    }

    findJob(jobId: string): Promise<CleanupJobSnapshot | null> {
        return Promise.resolve(this.job !== null && this.job.id === jobId ? this.job : null);
    }

    startJob(jobId: string): Promise<boolean> {
        if (!this.startWins) return Promise.resolve(false);
        this.started.push(jobId);
        return Promise.resolve(true);
    }

    readSetting(key: string): Promise<string | null> {
        return Promise.resolve(this.settings.get(key) ?? null);
    }

    loadScanBatch(): Promise<CleanupScanBatch> {
        return Promise.resolve(this.batch);
    }

    recordFailedAttempt(input: CleanupFailedAttempt): Promise<void> {
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

    commitCleanup(input: CleanupCommit): Promise<{ readonly suggestionsCreated: number } | null> {
        if (!this.commitWins) return Promise.resolve(null);
        this.commits.push(input);
        return Promise.resolve({ suggestionsCreated: input.suggestions.length });
    }

    failJob(jobId: string, message: string): Promise<CleanupJobSnapshot | null> {
        if (this.job === null || this.job.id !== jobId) return Promise.resolve(null);
        this.failures.push({ jobId, message });
        return Promise.resolve(this.job);
    }
}
