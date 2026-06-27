import { Inject, Injectable, Logger } from "@nestjs/common";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { randomUUID } from "node:crypto";
import { RecipeScanAgent } from "../agent/recipe.scan.agent.js";
import type {
    RecipeOutputLanguage,
    RecipeTaskSnapshot,
} from "../agent/recipe.scan.prompt.js";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { APP_SETTING_KEYS } from "@monitor/identity-api/settings/domain/app.setting.keys.js";
import { AppSettingService } from "@monitor/identity-api/settings/application/app.setting.service.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { GetTaskSummaryUseCase } from "@monitor/run-api/task/application/get.task.summary.usecase.js";
import type { ITaskSnapshotQuery } from "@monitor/run-api/task/public/iservice/task.snapshot.query.iservice.js";
import { TASK_SNAPSHOT_QUERY } from "@monitor/run-api/task/public/tokens.js";
import {
    RecipeCandidateRepository,
    type InsertRecipeCandidateRow,
} from "../repository/recipe.candidate.repository.js";
import { RecipeRepository } from "../repository/recipe.repository.js";
import { InsightJobRepository } from "../../job/insight.job.repository.js";
import type { InsightJobEntity } from "../../job/insight.job.entity.js";
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
        private readonly jobs: InsightJobRepository,
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
    ): Promise<InsightJobEntity> {
        const existing = await this.jobs.findActive("recipe_scan");
        if (existing) {
            // 레시피 스캔은 전체 태스크 집합을 읽으므로 동시에 하나만 허용한다.
            throw new RecipeScanAlreadyInFlightError(existing.id);
        }

        const apiKey = await this.settings.getAnthropicApiKey();
        if (this.agent.requiresLocalApiKey() && !apiKey) {
            // 로컬 실행기가 API 키를 직접 써야 하면 잡을 만들기 전에 거부한다.
            throw new MissingApiKeyError();
        }

        const filters = normalizeRecipeScanFilters(input);

        const tasks = await this.taskQuery.findAll(filters.archivedScope);
        const filtered = applyRecipeScanFilters(tasks, filters);
        if (filtered.length === 0) {
            // 필터를 통과한 태스크가 없으면 LLM 스캔 결과도 만들 수 없다.
            throw new NoTasksToScanError();
        }

        const language = await this.resolveLanguage();
        return this.jobs.insert({
            id: randomUUID(),
            jobType: "recipe_scan",
            filtersJson: JSON.stringify(filters),
            language,
            createdAt: new Date().toISOString(),
        });
    }

    async run(input: EnqueueRecipeScanInput = {}): Promise<InsightJobEntity> {
        const job = await this.enqueue(input);
        await this.execute(job);
        const completed = await this.findById(job.id);
        return completed ?? job;
    }

    async findLatest(): Promise<InsightJobEntity | null> {
        return this.jobs.findLatest("recipe_scan");
    }

    async findById(id: string): Promise<InsightJobEntity | null> {
        return this.jobs.findById(id);
    }

    async execute(job: InsightJobEntity): Promise<void> {
        this.notifier.publish({
            type: NOTIFICATION_TYPE.sdkJobUpdated,
            payload: {
                kind: "recipe-scan",
                status: "running",
                jobId: job.id,
            },
        });
        try {
            const apiKey = await this.settings.getAnthropicApiKey();
            // 실행 시점에도 키를 다시 확인해 오래된 pending 잡이 잘못 실행되지 않게 한다.
            if (this.agent.requiresLocalApiKey() && !apiKey) throw new MissingApiKeyError();

            const modelOverride = await this.settings.getAnthropicModel();
            const filters = parseRecipeScanFilters(job.filtersJson ?? "{}");
            const language = normalizeRecipeLanguage(job.language);

            const allTasks = await this.taskQuery.findAll(filters.archivedScope);
            const filtered = applyRecipeScanFilters(allTasks, filters);

            const snapshots: RecipeTaskSnapshot[] = [];
            for (const t of filtered) {
                const { summary } = await this.getTaskSummary.execute({
                    taskId: t.id,
                });
                // 요약이 없거나 이벤트 수가 기준보다 적으면 학습할 패턴이 부족해 제외한다.
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
                // enqueue 이후 조건이 바뀐 경우 실패가 아니라 빈 성공으로 기록한다.
                await this.jobs.markCompleted({
                    id: job.id,
                    candidatesCreated: 0,
                    tasksScanned: 0,
                    modelUsed: modelOverride?.trim() || "n/a",
                    durationMs: 0,
                    completedAt: new Date().toISOString(),
                });
                this.notifier.publish({
                    type: NOTIFICATION_TYPE.sdkJobUpdated,
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

            const activeRecipes = await this.recipes.listByStatus("active");
            const activeRecipeTaskIds = activeRecipes.map((r) => ({
                recipe: r,
                taskIds: extractTaskIdsFromSlices(r.contributingSlicesJson),
            }));

            for (const recipe of output.recipes) {
                const validSlices = recipe.contributing_slices.filter((slice) =>
                    knownTaskIds.has(slice.taskId),
                );
                // 현재 스캔 대상 밖의 slice만 있는 후보는 적용 근거가 없으므로 버린다.
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

            // 스캔 완료 후 성과가 낮거나 오래 미사용된 active 레시피를 가능한 범위에서 정리한다.
            await this.runRetirePolicy(activeRecipes, now);

            await this.jobs.markCompleted({
                id: job.id,
                candidatesCreated: rows.length,
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
                type: NOTIFICATION_TYPE.sdkJobUpdated,
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
