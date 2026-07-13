import { foldAttempt, type JobAttemptRecord } from "~ai-agent-worker/support/llm/job.attempt.js";
import type {
    RecipeAnchorSnapshot,
    RecipeFailedAttempt,
    RecipeJobSnapshot,
    RecipeRepositoryPort,
    RecipeScanCommit,
} from "../recipe.repository.port.js";

/** 레시피 저장 포트의 인메모리 대역이다. */
export class InMemoryRecipeRepository implements RecipeRepositoryPort {
    readonly settings = new Map<string, string>();
    readonly anchors = new Map<string, RecipeAnchorSnapshot>();
    readonly ownedTaskIds = new Set<string>();
    readonly failedAttempts: RecipeFailedAttempt[] = [];
    readonly commits: RecipeScanCommit[] = [];
    readonly failures: { readonly jobId: string; readonly message: string }[] = [];
    started: string[] = [];
    startWins = true;
    commitWins = true;
    private job: RecipeJobSnapshot | null = null;

    seedJob(job: RecipeJobSnapshot): void {
        this.job = job;
    }

    findJob(jobId: string): Promise<RecipeJobSnapshot | null> {
        return Promise.resolve(this.job !== null && this.job.id === jobId ? this.job : null);
    }

    startJob(jobId: string): Promise<boolean> {
        if (!this.startWins) return Promise.resolve(false);
        this.started.push(jobId);
        return Promise.resolve(true);
    }

    findAnchor(_userId: string, taskId: string): Promise<RecipeAnchorSnapshot | null> {
        return Promise.resolve(this.anchors.get(taskId) ?? null);
    }

    readSetting(key: string): Promise<string | null> {
        return Promise.resolve(this.settings.get(key) ?? null);
    }

    findOwnedTaskIds(_userId: string, taskIds: readonly string[]): Promise<readonly string[]> {
        return Promise.resolve(taskIds.filter((taskId) => this.ownedTaskIds.has(taskId)));
    }

    recordFailedAttempt(input: RecipeFailedAttempt): Promise<void> {
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

    commitScan(input: RecipeScanCommit): Promise<{ readonly candidatesCreated: number } | null> {
        if (!this.commitWins) return Promise.resolve(null);
        this.commits.push(input);
        return Promise.resolve({ candidatesCreated: input.recipes.length });
    }

    failJob(jobId: string, message: string): Promise<RecipeJobSnapshot | null> {
        if (this.job === null || this.job.id !== jobId) return Promise.resolve(null);
        this.failures.push({ jobId, message });
        return Promise.resolve(this.job);
    }
}
