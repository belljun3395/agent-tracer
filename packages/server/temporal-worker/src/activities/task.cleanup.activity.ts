import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { APP_SETTINGS } from "@monitor/identity-api/settings/public/tokens.js";
import { APP_SETTING_KEYS } from "@monitor/identity-api/settings/domain/app.setting.keys.js";
import type { IAppSettings } from "@monitor/identity-api/settings/public/iservice/app.settings.iservice.js";
import { TASK_SNAPSHOT_QUERY } from "@monitor/run-api/task/public/tokens.js";
import type { ITaskSnapshotQuery } from "@monitor/run-api/task/public/iservice/task.snapshot.query.iservice.js";
import { JOB_STATUS } from "@monitor/shared/job/job.status.const.js";
import { currentUserId } from "@monitor/shared/kernel/user/user.context.js";
import type { InsightJobRepository } from "@monitor/insight-api/job/insight.job.repository.js";
import type { TaskCleanupSuggestionRepository } from "@monitor/insight-api/task-cleanup/repository/task.cleanup.suggestion.repository.js";
import { dedupeByKindAndTask } from "@monitor/insight-api/task-cleanup/domain/task.cleanup.dedup.policy.js";
import type { TaskCleanupAgent, GenerateCleanupSuggestionsOutput } from "../agents/task.cleanup.agent.js";
import type { CleanupTaskSnapshot } from "../agents/task.cleanup.prompt.js";
import { MissingApiKeyError } from "../activity.errors.js";

const DEFAULT_MAX_SUGGESTIONS = 20;
const MAX_SUGGESTIONS_HARD_CAP = 50;

@Injectable()
export class TaskCleanupActivity {
    constructor(
        private readonly jobs: InsightJobRepository,
        private readonly suggestions: TaskCleanupSuggestionRepository,
        @Inject(APP_SETTINGS) private readonly settings: IAppSettings,
        @Inject(TASK_SNAPSHOT_QUERY) private readonly taskQuery: ITaskSnapshotQuery,
        private readonly agent: TaskCleanupAgent,
        @Inject(NOTIFICATION_PUBLISHER_TOKEN) private readonly notifier: INotificationPublisher,
    ) {}

    toActivities(): {
        runTaskCleanup: (jobId: string) => Promise<number>;
        applyTaskCleanup: (jobId: string) => Promise<number>;
        completeTaskCleanup: (jobId: string, suggestionsCreated: number, tasksScanned: number) => Promise<void>;
        failTaskCleanup: (jobId: string, error: string) => Promise<void>;
    } {
        return {
            runTaskCleanup: (jobId) => this.runTaskCleanup(jobId),
            applyTaskCleanup: (jobId) => this.applyTaskCleanup(jobId),
            completeTaskCleanup: (jobId, suggestionsCreated, tasksScanned) =>
                this.completeTaskCleanup(jobId, suggestionsCreated, tasksScanned),
            failTaskCleanup: (jobId, error) => this.failTaskCleanup(jobId, error),
        };
    }

    // run 단계: 스냅샷 수집 → LLM 추론(결과 저장). 재시도 시 저장된 응답을 재사용하며 알림을 중복 발행하지 않는다.
    async runTaskCleanup(jobId: string): Promise<number> {
        const job = await this.loadJob(jobId);

        if (job.llmOutputJson) {
            const saved = JSON.parse(job.llmOutputJson) as GenerateCleanupSuggestionsOutput & { tasksScanned: number };
            return saved.tasksScanned ?? 0;
        }

        this.notifier.publish({
            type: NOTIFICATION_TYPE.sdkJobUpdated,
            payload: { kind: "task-cleanup", status: "running", jobId },
        });

        const apiKey = await this.settings.getAnthropicApiKey();
        if (!apiKey) throw new MissingApiKeyError();
        const modelOverride = await this.settings.getAnthropicModel();
        const maxRaw = await this.settings.getRawValue(APP_SETTING_KEYS.taskCleanupMaxSuggestions);
        const maxSuggestions = clampMax(maxRaw);

        const tasks = await this.taskQuery.findAll("active");
        const snapshots: CleanupTaskSnapshot[] = tasks.map((t) => ({
            id: t.id,
            title: t.displayTitle ?? t.title,
            slug: t.slug,
            status: t.status,
            taskKind: t.taskKind ?? "primary",
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
            ...(t.lastSessionStartedAt ? { lastSessionStartedAt: t.lastSessionStartedAt } : {}),
            ...(t.workspacePath ? { workspacePath: t.workspacePath } : {}),
            ...(t.parentTaskId ? { parentTaskId: t.parentTaskId } : {}),
        }));

        const tasksScanned = snapshots.length;

        if (tasksScanned === 0) {
            const emptyMemo = { suggestions: [], modelUsed: "n/a", durationMs: 0, costUsd: null, numTurns: null, usage: null, tasksScanned: 0 };
            await this.jobs.saveLlmOutput(jobId, JSON.stringify(emptyMemo), new Date().toISOString());
            return 0;
        }

        const output = await this.agent.generate({
            ...(apiKey ? { apiKey } : {}),
            ...(modelOverride ? { model: modelOverride } : {}),
            tasks: snapshots,
            maxSuggestions,
        });

        await this.jobs.saveLlmOutput(
            jobId,
            JSON.stringify({ ...output, tasksScanned }),
            new Date().toISOString(),
        );

        return tasksScanned;
    }

    // apply 단계: 저장된 응답으로 정리 제안을 등록하고 새로 만든 수를 반환한다.
    async applyTaskCleanup(jobId: string): Promise<number> {
        const job = await this.loadJob(jobId);
        if (!job.llmOutputJson) throw new Error(`memoized LLM output missing for job ${jobId}`);

        const memo = JSON.parse(job.llmOutputJson) as GenerateCleanupSuggestionsOutput & { tasksScanned: number };
        if (memo.suggestions.length === 0) return 0;

        const userId = currentUserId();

        // 재시도 안전: 이미 삽입된 제안이 있으면 중복 삽입을 건너뛴다.
        const alreadyInserted = await this.suggestions.countByJobId(jobId, userId);
        if (alreadyInserted > 0) return alreadyInserted;

        const allTasks = await this.taskQuery.findAll("active");
        const knownTaskIds = new Set(allTasks.map((t) => t.id));

        const now = new Date().toISOString();
        const rows = dedupeByKindAndTask(memo.suggestions, knownTaskIds).map((s) => ({
            id: randomUUID(),
            userId,
            jobId,
            taskId: s.taskId,
            kind: s.kind,
            currentValue: null,
            proposedValue: JSON.stringify({ archive: true }),
            rationale: s.rationale,
            createdAt: now,
        }));

        await this.suggestions.insertMany(rows);
        return rows.length;
    }

    // complete 단계: 통계 기록 후 완료 알림. 재시도 시 멱등.
    async completeTaskCleanup(
        jobId: string,
        suggestionsCreated: number,
        tasksScanned: number,
    ): Promise<void> {
        const job = await this.loadJob(jobId);
        if (job.status === JOB_STATUS.completed) return;
        if (!job.llmOutputJson) throw new Error(`memoized LLM output missing for job ${jobId}`);

        const memo = JSON.parse(job.llmOutputJson) as GenerateCleanupSuggestionsOutput & { tasksScanned: number };

        await this.jobs.markCompleted({
            id: jobId,
            suggestionsCreated,
            tasksScanned,
            modelUsed: memo.modelUsed,
            durationMs: memo.durationMs,
            costUsd: memo.costUsd,
            numTurns: memo.numTurns,
            usage: memo.usage,
            completedAt: new Date().toISOString(),
        });

        this.notifier.publish({
            type: NOTIFICATION_TYPE.sdkJobUpdated,
            payload: {
                kind: "task-cleanup",
                status: "succeeded",
                jobId,
                summary:
                    suggestionsCreated === 0
                        ? `No cleanup suggestions for ${tasksScanned} tasks`
                        : `${suggestionsCreated} cleanup ${suggestionsCreated === 1 ? "suggestion" : "suggestions"} for ${tasksScanned} tasks`,
                durationMs: memo.durationMs,
            },
        });
    }

    async failTaskCleanup(jobId: string, error: string): Promise<void> {
        const attempts = await this.jobs.incrementAttempts(jobId, new Date().toISOString());
        await this.jobs.markFailed({
            id: jobId,
            error: truncate(error, 1000),
            attempts,
            completedAt: new Date().toISOString(),
        });
        this.notifier.publish({
            type: NOTIFICATION_TYPE.sdkJobUpdated,
            payload: {
                kind: "task-cleanup",
                status: "failed",
                jobId,
                error: truncate(error, 240),
            },
        });
    }

    private async loadJob(jobId: string) {
        const job = await this.jobs.findById(jobId);
        if (!job) throw new Error(`insight job not found: ${jobId}`);
        return job;
    }
}

function clampMax(raw: string | null): number {
    if (!raw) return DEFAULT_MAX_SUGGESTIONS;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_SUGGESTIONS;
    return Math.min(Math.max(n, 1), MAX_SUGGESTIONS_HARD_CAP);
}

function truncate(s: string, n: number): string {
    return s.length <= n ? s : s.slice(0, n) + "...";
}
