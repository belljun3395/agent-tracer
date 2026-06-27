import { Inject, Injectable, Logger } from "@nestjs/common";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { randomUUID } from "node:crypto";
import { TaskCleanupAgent } from "./task.cleanup.agent.js";
import type { CleanupTaskSnapshot } from "./task.cleanup.prompt.js";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { APP_SETTING_KEYS } from "@monitor/identity-api/settings/domain/app.setting.keys.js";
import { AppSettingService } from "@monitor/identity-api/settings/application/app.setting.service.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import type { ITaskSnapshotQuery } from "@monitor/run-api/task/public/iservice/task.snapshot.query.iservice.js";
import { TASK_SNAPSHOT_QUERY } from "@monitor/run-api/task/public/tokens.js";
import { InsightJobRepository } from "../../job/insight.job.repository.js";
import { TaskCleanupSuggestionRepository } from "../repository/task.cleanup.suggestion.repository.js";
import type { InsightJobEntity } from "../../job/insight.job.entity.js";
import { dedupeByKindAndTask } from "../domain/task.cleanup.dedup.js";

const DEFAULT_MAX_SUGGESTIONS = 20;
const MAX_SUGGESTIONS_HARD_CAP = 50;

export class GenerationAlreadyInFlightError extends Error {
    constructor(public readonly jobId: string) {
        super(`A cleanup scan is already in flight (jobId=${jobId}).`);
        this.name = "GenerationAlreadyInFlightError";
    }
}

export class MissingApiKeyError extends Error {
    constructor() {
        super("No Anthropic API key configured. Set anthropic.api_key in Settings.");
        this.name = "MissingApiKeyError";
    }
}

export class NoTasksToScanError extends Error {
    constructor() {
        super("No active tasks to scan.");
        this.name = "NoTasksToScanError";
    }
}

@Injectable()
export class TaskCleanupService {
    private readonly logger = new Logger(TaskCleanupService.name);

    constructor(
        private readonly jobs: InsightJobRepository,
        private readonly suggestions: TaskCleanupSuggestionRepository,
        private readonly settings: AppSettingService,
        @Inject(TASK_SNAPSHOT_QUERY)
        private readonly taskQuery: ITaskSnapshotQuery,
        private readonly agent: TaskCleanupAgent,
        @Inject(NOTIFICATION_PUBLISHER_TOKEN)
        private readonly notifier: INotificationPublisher,
    ) {}

    async enqueue(): Promise<InsightJobEntity> {
        const existing = await this.jobs.findActive("task_cleanup");
        if (existing) {
            // 정리 스캔은 워크스페이스 단위 결과라 동시에 하나만 실행한다.
            throw new GenerationAlreadyInFlightError(existing.id);
        }

        const apiKey = await this.settings.getAnthropicApiKey();
        if (this.agent.requiresLocalApiKey() && !apiKey) {
            // 로컬 실행기가 API 키를 직접 써야 하면 잡을 만들기 전에 거부한다.
            throw new MissingApiKeyError();
        }

        const tasks = await this.taskQuery.findAll("active");
        if (tasks.length === 0) {
            // 활성 태스크가 없으면 생성할 정리 제안도 없다.
            throw new NoTasksToScanError();
        }

        return this.jobs.insert({
            id: randomUUID(),
            jobType: "task_cleanup",
            createdAt: new Date().toISOString(),
        });
    }

    async run(): Promise<InsightJobEntity> {
        const job = await this.enqueue();
        await this.execute(job);
        const completed = await this.findById(job.id);
        return completed ?? job;
    }

    async findLatest(): Promise<InsightJobEntity | null> {
        return this.jobs.findLatest("task_cleanup");
    }

    async findById(id: string): Promise<InsightJobEntity | null> {
        return this.jobs.findById(id);
    }

    async execute(job: InsightJobEntity): Promise<void> {
        this.notifier.publish({
            type: NOTIFICATION_TYPE.sdkJobUpdated,
            payload: {
                kind: "task-cleanup",
                status: "running",
                jobId: job.id,
            },
        });
        try {
            const apiKey = await this.settings.getAnthropicApiKey();
            // 실행 시점에도 키를 다시 확인해 오래된 pending 잡이 잘못 실행되지 않게 한다.
            if (this.agent.requiresLocalApiKey() && !apiKey) throw new MissingApiKeyError();

            const modelOverride = await this.settings.getAnthropicModel();
            const maxRaw = await this.settings.getRawValue(
                APP_SETTING_KEYS.taskCleanupMaxSuggestions,
            );
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
                ...(t.lastSessionStartedAt
                    ? { lastSessionStartedAt: t.lastSessionStartedAt }
                    : {}),
                ...(t.workspacePath ? { workspacePath: t.workspacePath } : {}),
                ...(t.parentTaskId ? { parentTaskId: t.parentTaskId } : {}),
            }));

            const output = await this.agent.generate({
                ...(apiKey ? { apiKey } : {}),
                ...(modelOverride ? { model: modelOverride } : {}),
                tasks: snapshots,
                maxSuggestions,
            });

            const knownTaskIds = new Set(snapshots.map((s) => s.id));
            const now = new Date().toISOString();
            const rows = dedupeByKindAndTask(output.suggestions, knownTaskIds).map(
                (s) => ({
                    id: randomUUID(),
                    jobId: job.id,
                    taskId: s.taskId,
                    kind: s.kind,
                    currentValue: null,
                    proposedValue: JSON.stringify({ archive: true }),
                    rationale: s.rationale,
                    createdAt: now,
                }),
            );
            await this.suggestions.insertMany(rows);

            await this.jobs.markCompleted({
                id: job.id,
                suggestionsCreated: rows.length,
                tasksScanned: snapshots.length,
                modelUsed: output.modelUsed,
                durationMs: output.durationMs,
                costUsd: output.costUsd,
                numTurns: output.numTurns,
                usage: output.usage,
                completedAt: new Date().toISOString(),
            });
            this.notifier.publish({
                type: NOTIFICATION_TYPE.sdkJobUpdated,
                payload: {
                    kind: "task-cleanup",
                    status: "succeeded",
                    jobId: job.id,
                    summary:
                        rows.length === 0
                            ? `No cleanup suggestions for ${snapshots.length} tasks`
                            : `${rows.length} cleanup ${rows.length === 1 ? "suggestion" : "suggestions"} for ${snapshots.length} tasks`,
                    durationMs: output.durationMs,
                },
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(
                `Task cleanup scan failed for job=${job.id}: ${message}`,
            );
            const attempts = await this.jobs.incrementAttempts(
                job.id,
                new Date().toISOString(),
            );
            await this.jobs.markFailed({
                id: job.id,
                error: truncate(message, 1000),
                attempts,
                completedAt: new Date().toISOString(),
            });
            this.notifier.publish({
                type: NOTIFICATION_TYPE.sdkJobUpdated,
                payload: {
                    kind: "task-cleanup",
                    status: "failed",
                    jobId: job.id,
                    error: truncate(message, 240),
                },
            });
        }
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
