import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { TaskCleanupAgent } from "~adapters/llm/task.cleanup.agent.js";
import type { CleanupTaskSnapshot } from "~adapters/llm/task.cleanup.prompt.js";
import { APP_SETTING_KEYS } from "~governance/settings/domain/app.setting.keys.js";
import { AppSettingService } from "~governance/settings/application/app.setting.service.js";
import { TaskQueryService } from "~work/task/service/task.query.service.js";
import { TaskCleanupJobRepository } from "../repository/task.cleanup.job.repository.js";
import { TaskCleanupSuggestionRepository } from "../repository/task.cleanup.suggestion.repository.js";
import type { TaskCleanupJobEntity } from "../domain/task.cleanup.job.entity.js";

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
        private readonly jobs: TaskCleanupJobRepository,
        private readonly suggestions: TaskCleanupSuggestionRepository,
        private readonly settings: AppSettingService,
        private readonly taskQuery: TaskQueryService,
        private readonly agent: TaskCleanupAgent,
    ) {}

    async enqueue(): Promise<TaskCleanupJobEntity> {
        const existing = await this.jobs.findActive();
        if (existing) {
            throw new GenerationAlreadyInFlightError(existing.id);
        }

        const apiKey = await this.settings.getAnthropicApiKey();
        if (!apiKey) {
            throw new MissingApiKeyError();
        }

        const tasks = await this.taskQuery.findAll("active");
        if (tasks.length === 0) {
            throw new NoTasksToScanError();
        }

        return this.jobs.insert({
            id: randomUUID(),
            createdAt: new Date().toISOString(),
        });
    }

    async findLatest(): Promise<TaskCleanupJobEntity | null> {
        return this.jobs.findLatest();
    }

    async findById(id: string): Promise<TaskCleanupJobEntity | null> {
        return this.jobs.findById(id);
    }

    /**
     * Execute one claimed job. Caller is responsible for atomic claim before
     * calling. Updates job status to completed/failed at the end.
     */
    async execute(job: TaskCleanupJobEntity): Promise<void> {
        try {
            const apiKey = await this.settings.getAnthropicApiKey();
            if (!apiKey) throw new MissingApiKeyError();

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
                apiKey,
                ...(modelOverride ? { model: modelOverride } : {}),
                tasks: snapshots,
                maxSuggestions,
            });

            const knownTaskIds = new Set(snapshots.map((s) => s.id));
            const dedupKey = (kind: string, taskId: string) => `${kind}::${taskId}`;
            const seen = new Set<string>();
            const now = new Date().toISOString();
            const rows: Parameters<
                TaskCleanupSuggestionRepository["insertMany"]
            >[0][number][] = [];
            for (const s of output.suggestions) {
                if (!knownTaskIds.has(s.taskId)) continue;
                const key = dedupKey(s.kind, s.taskId);
                if (seen.has(key)) continue;
                seen.add(key);
                const taskSnap = snapshots.find((t) => t.id === s.taskId);
                let currentValue: unknown = null;
                let proposedValue: unknown = null;
                switch (s.kind) {
                    case "archive":
                        currentValue = null;
                        proposedValue = { archive: true };
                        break;
                    case "rename_title":
                        currentValue = { title: taskSnap?.title ?? null };
                        proposedValue = { title: s.proposedTitle };
                        break;
                    case "set_parent":
                        if (!knownTaskIds.has(s.proposedParentTaskId)) continue;
                        if (s.proposedParentTaskId === s.taskId) continue;
                        currentValue = { parentTaskId: taskSnap?.parentTaskId ?? null };
                        proposedValue = { parentTaskId: s.proposedParentTaskId };
                        break;
                    case "reslug":
                        currentValue = { slug: taskSnap?.slug ?? null };
                        proposedValue = { slug: s.proposedSlug };
                        break;
                }
                rows.push({
                    id: randomUUID(),
                    jobId: job.id,
                    taskId: s.taskId,
                    kind: s.kind,
                    currentValue: currentValue ? JSON.stringify(currentValue) : null,
                    proposedValue: proposedValue ? JSON.stringify(proposedValue) : null,
                    rationale: s.rationale,
                    createdAt: now,
                });
            }
            await this.suggestions.insertMany(rows);

            await this.jobs.markCompleted({
                id: job.id,
                suggestionsCreated: rows.length,
                tasksScanned: snapshots.length,
                modelUsed: output.modelUsed,
                durationMs: output.durationMs,
                completedAt: new Date().toISOString(),
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
