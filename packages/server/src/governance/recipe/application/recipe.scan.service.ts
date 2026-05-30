import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { RecipeScanAgent } from "~adapters/llm/recipe.scan.agent.js";
import type {
    RecipeOutputLanguage,
    RecipeTaskSnapshot,
} from "~adapters/llm/recipe.scan.prompt.js";
import type { INotificationPublisher } from "~adapters/notifications/notification.publisher.port.js";
import { APP_SETTING_KEYS } from "~governance/settings/domain/app.setting.keys.js";
import { AppSettingService } from "~governance/settings/application/app.setting.service.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "~main/presentation/database/database.provider.js";
import { GetTaskSummaryUseCase } from "~work/task/application/get.task.summary.usecase.js";
import type { ITaskSnapshotQuery } from "~work/task/public/iservice/task.snapshot.query.iservice.js";
import { TASK_SNAPSHOT_QUERY } from "~work/task/public/tokens.js";
import {
    RecipeCandidateRepository,
    type InsertRecipeCandidateRow,
} from "../repository/recipe.candidate.repository.js";
import { RecipeRepository } from "../repository/recipe.repository.js";
import { RecipeScanJobRepository } from "../repository/recipe.scan.job.repository.js";
import type { RecipeScanJobEntity } from "../domain/recipe.scan.job.entity.js";
import type { RecipeEntity } from "../domain/recipe.entity.js";
import { extractTaskIdsFromSlices, pickBestParent } from "../domain/recipe.parentage.js";
import {
    applyRecipeScanFilters,
    normalizeRecipeLanguage,
    normalizeRecipeScanFilters,
    parseRecipeScanFilters,
} from "../domain/recipe.scan.filters.js";
import type { EnqueueRecipeScanInput } from "./dto/recipe.scan.dto.js";

export class RecipeScanAlreadyInFlightError extends Error {
    constructor(public readonly jobId: string) {
        super(`A recipe scan is already in flight (jobId=${jobId}).`);
        this.name = "RecipeScanAlreadyInFlightError";
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
        super("No tasks match the scan filters.");
        this.name = "NoTasksToScanError";
    }
}

@Injectable()
export class RecipeScanService {
    private readonly logger = new Logger(RecipeScanService.name);

    constructor(
        private readonly jobs: RecipeScanJobRepository,
        private readonly candidates: RecipeCandidateRepository,
        private readonly recipes: RecipeRepository,
        private readonly settings: AppSettingService,
        @Inject(TASK_SNAPSHOT_QUERY)
        private readonly taskQuery: ITaskSnapshotQuery,
        private readonly getTaskSummary: GetTaskSummaryUseCase,
        private readonly agent: RecipeScanAgent,
        @Inject(NOTIFICATION_PUBLISHER_TOKEN)
        private readonly notifier: INotificationPublisher,
    ) {}

    async enqueue(
        input: EnqueueRecipeScanInput = {},
    ): Promise<RecipeScanJobEntity> {
        const existing = await this.jobs.findActive();
        if (existing) {
            throw new RecipeScanAlreadyInFlightError(existing.id);
        }

        const apiKey = await this.settings.getAnthropicApiKey();
        if (this.agent.requiresLocalApiKey() && !apiKey) {
            throw new MissingApiKeyError();
        }

        const filters = normalizeRecipeScanFilters(input);
        // Validate there's at least one task matching before opening a job —
        // mirrors task-cleanup's NoTasksToScanError preflight.
        const tasks = await this.taskQuery.findAll(filters.archivedScope);
        const filtered = applyRecipeScanFilters(tasks, filters);
        if (filtered.length === 0) {
            throw new NoTasksToScanError();
        }

        const language = await this.resolveLanguage();
        return this.jobs.insert({
            id: randomUUID(),
            filtersJson: JSON.stringify(filters),
            language,
            createdAt: new Date().toISOString(),
        });
    }

    async findLatest(): Promise<RecipeScanJobEntity | null> {
        return this.jobs.findLatest();
    }

    async findById(id: string): Promise<RecipeScanJobEntity | null> {
        return this.jobs.findById(id);
    }

    async execute(job: RecipeScanJobEntity): Promise<void> {
        this.notifier.publish({
            type: "sdk_job.updated",
            payload: {
                kind: "recipe-scan",
                status: "running",
                jobId: job.id,
            },
        });
        try {
            const apiKey = await this.settings.getAnthropicApiKey();
            if (this.agent.requiresLocalApiKey() && !apiKey) throw new MissingApiKeyError();

            const modelOverride = await this.settings.getAnthropicModel();
            const filters = parseRecipeScanFilters(job.filtersJson);
            const language = normalizeRecipeLanguage(job.language);

            const allTasks = await this.taskQuery.findAll(filters.archivedScope);
            const filtered = applyRecipeScanFilters(allTasks, filters);

            const snapshots: RecipeTaskSnapshot[] = [];
            for (const t of filtered) {
                const { summary } = await this.getTaskSummary.execute({
                    taskId: t.id,
                });
                if (!summary) continue;
                if (summary.eventCount < filters.minEventCount) continue;
                snapshots.push({
                    id: summary.id,
                    title: summary.title,
                    status: summary.status,
                    taskKind: t.taskKind ?? "primary",
                    ...(summary.workspacePath
                        ? { workspacePath: summary.workspacePath }
                        : {}),
                    createdAt: summary.createdAt,
                    updatedAt: summary.updatedAt,
                    ...(summary.firstUserMessage
                        ? { firstUserMessage: summary.firstUserMessage }
                        : {}),
                    eventCount: summary.eventCount,
                    toolCounts: summary.toolCounts,
                    topFiles: summary.topFiles,
                    topCommands: summary.topCommands,
                });
            }

            if (snapshots.length === 0) {
                await this.jobs.markCompleted({
                    id: job.id,
                    candidatesCreated: 0,
                    tasksScanned: 0,
                    modelUsed: modelOverride?.trim() || "n/a",
                    durationMs: 0,
                    completedAt: new Date().toISOString(),
                });
                this.notifier.publish({
                    type: "sdk_job.updated",
                    payload: {
                        kind: "recipe-scan",
                        status: "succeeded",
                        jobId: job.id,
                        summary: "No tasks matched scan filters",
                        durationMs: 0,
                    },
                });
                return;
            }

            const output = await this.agent.generate({
                ...(apiKey ? { apiKey } : {}),
                ...(modelOverride ? { model: modelOverride } : {}),
                tasks: snapshots,
                maxCandidates: filters.maxCandidates,
                language,
            });

            const knownTaskIds = new Set(snapshots.map((s) => s.id));
            const now = new Date().toISOString();
            const rows: InsertRecipeCandidateRow[] = [];

            // For parent-linking we need every active recipe + its task ids.
            // O(active recipes) for the whole scan — bounded since a workspace
            // usually has at most dozens of active recipes.
            const activeRecipes = await this.recipes.listByStatus("active");
            const activeRecipeTaskIds = activeRecipes.map((r) => ({
                recipe: r,
                taskIds: extractTaskIdsFromSlices(r.contributingSlicesJson),
            }));

            for (const recipe of output.recipes) {
                const validSlices = recipe.contributing_slices.filter((slice) =>
                    knownTaskIds.has(slice.taskId),
                );
                if (validSlices.length === 0) continue;

                const candidateTaskIds = new Set(
                    validSlices.map((s) => s.taskId),
                );
                const parent = pickBestParent(
                    candidateTaskIds,
                    activeRecipeTaskIds,
                );

                rows.push({
                    id: randomUUID(),
                    jobId: job.id,
                    title: recipe.title,
                    intent: recipe.intent,
                    description: recipe.description,
                    summaryMd: recipe.summary_md,
                    stepsJson: JSON.stringify(recipe.steps),
                    touchedFilesJson: JSON.stringify(recipe.touched_files),
                    contributingSlicesJson: JSON.stringify(
                        validSlices.map((s) => ({
                            taskId: s.taskId,
                            eventIds: s.eventIds,
                        })),
                    ),
                    rationale: recipe.rationale,
                    language,
                    parentRecipeId: parent?.id ?? null,
                    createdAt: now,
                });
            }
            await this.candidates.insertMany(rows);

            // Best-effort retire policy: prune underperforming active recipes
            // at the end of every scan. Never blocks scan completion.
            await this.runRetirePolicy(activeRecipes, now);

            await this.jobs.markCompleted({
                id: job.id,
                candidatesCreated: rows.length,
                tasksScanned: snapshots.length,
                modelUsed: output.modelUsed,
                durationMs: output.durationMs,
                completedAt: new Date().toISOString(),
            });
            this.notifier.publish({
                type: "sdk_job.updated",
                payload: {
                    kind: "recipe-scan",
                    status: "succeeded",
                    jobId: job.id,
                    summary:
                        rows.length === 0
                            ? `No recipe candidates from ${snapshots.length} tasks`
                            : `${rows.length} recipe ${rows.length === 1 ? "candidate" : "candidates"} from ${snapshots.length} tasks`,
                    durationMs: output.durationMs,
                },
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(
                `Recipe scan failed for job=${job.id}: ${message}`,
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
                type: "sdk_job.updated",
                payload: {
                    kind: "recipe-scan",
                    status: "failed",
                    jobId: job.id,
                    error: truncate(message, 240),
                },
            });
        }
    }

    private async resolveLanguage(): Promise<RecipeOutputLanguage> {
        const raw = await this.settings.getRawValue(
            APP_SETTING_KEYS.claudeOutputLanguage,
        );
        return normalizeRecipeLanguage(raw);
    }

    /**
     * Retire policy — runs after every successful scan.
     *
     * A recipe is retired when:
     *   - applied_count >= 5 AND success_rate < 0.3 (failing too often)
     *   - or applied_count == 0 AND age > 14 days (nobody used it)
     */
    private async runRetirePolicy(
        active: readonly RecipeEntity[],
        nowIso: string,
    ): Promise<void> {
        for (const r of active) {
            if (!r.shouldRetire(nowIso)) continue;
            await this.recipes.setStatus(r.id, "retired", nowIso);
            this.logger.log(
                `Auto-retired recipe ${r.id} (applied=${r.appliedCount}, success=${r.successCount})`,
            );
        }
    }
}

function truncate(s: string, n: number): string {
    return s.length <= n ? s : s.slice(0, n) + "...";
}
