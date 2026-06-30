import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Context } from "@temporalio/activity";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { APP_SETTINGS } from "@monitor/identity-api/settings/public/tokens.js";
import type { IAppSettings } from "@monitor/identity-api/settings/public/iservice/app.settings.iservice.js";
import { TASK_SNAPSHOT_QUERY, TASK_SUMMARY } from "@monitor/run-api/public/task/tokens.js";
import type { ITaskSnapshotQuery } from "@monitor/run-api/public/task/iservice/task.snapshot.query.iservice.js";
import type { ITaskSummary } from "@monitor/run-api/public/task/iservice/task.summary.iservice.js";
import { TIMELINE_EVENT_READ } from "@monitor/timeline-api/public/event/tokens.js";
import type { ITimelineEventRead } from "@monitor/timeline-api/public/event/iservice/timeline.event.read.iservice.js";
import { JOB_STATUS } from "@monitor/shared/job/job.status.const.js";
import { InsightJobRepository } from "@monitor/insight-api/repository/job/insight.job.repository.js";
import { RecipeCandidateRepository } from "@monitor/insight-api/repository/recipe/recipe.candidate.repository.js";
import type { InsertRecipeCandidateRow } from "@monitor/insight-api/repository/recipe/recipe.candidate.repository.js";
import { RecipeRepository } from "@monitor/insight-api/repository/recipe/recipe.repository.js";
import type { RecipeEntity } from "@monitor/insight-api/domain/recipe/recipe.entity.js";
import {
    parseRecipeScanFilters,
    normalizeRecipeLanguage,
} from "@monitor/insight-api/domain/recipe/recipe.scan.filters.policy.js";
import {
    extractTaskIdsFromSlices,
    pickBestParent,
} from "@monitor/insight-api/domain/recipe/recipe.parentage.policy.js";
import { RecipeScanAgent } from "../agents/recipe.scan.agent.js";
import type { GenerateRecipeCandidatesOutput } from "../agents/recipe.scan.agent.js";
import { buildRecipeScanTools } from "../agent-tools/recipe.scan.tools.js";
import { MissingApiKeyError } from "../activity.errors.js";

@Injectable()
export class RecipeScanActivity {
    constructor(
        private readonly jobs: InsightJobRepository,
        private readonly candidates: RecipeCandidateRepository,
        private readonly recipes: RecipeRepository,
        @Inject(APP_SETTINGS) private readonly settings: IAppSettings,
        @Inject(TASK_SNAPSHOT_QUERY) private readonly taskQuery: ITaskSnapshotQuery,
        @Inject(TASK_SUMMARY) private readonly taskSummary: ITaskSummary,
        @Inject(TIMELINE_EVENT_READ) private readonly eventRead: ITimelineEventRead,
        private readonly agent: RecipeScanAgent,
        @Inject(NOTIFICATION_PUBLISHER_TOKEN) private readonly notifier: INotificationPublisher,
    ) {}

    toActivities(): {
        runRecipeScan: (jobId: string) => Promise<number>;
        insertRecipeCandidates: (jobId: string) => Promise<number>;
        retireStaleRecipes: () => Promise<void>;
        completeRecipeScan: (jobId: string, candidatesCreated: number, tasksScanned: number) => Promise<void>;
        failRecipeScan: (jobId: string, error: string) => Promise<void>;
    } {
        return {
            runRecipeScan: (jobId) => this.runRecipeScan(jobId),
            insertRecipeCandidates: (jobId) => this.insertRecipeCandidates(jobId),
            retireStaleRecipes: () => this.retireStaleRecipes(),
            completeRecipeScan: (jobId, candidatesCreated, tasksScanned) =>
                this.completeRecipeScan(jobId, candidatesCreated, tasksScanned),
            failRecipeScan: (jobId, error) => this.failRecipeScan(jobId, error),
        };
    }

    // run 단계: 스냅샷 수집 → LLM 추론(결과 저장). 재시도 시 저장된 응답을 재사용하며 알림을 중복 발행하지 않는다.
    async runRecipeScan(jobId: string): Promise<number> {
        const ctx = Context.current();
        const attempt = ctx.info.attempt;
        process.stdout.write(`[recipe-scan] runRecipeScan start jobId=${jobId} attempt=${attempt}\n`);

        const job = await this.loadJob(jobId);

        if (job.llmOutputJson) {
            process.stdout.write(`[recipe-scan] reusing memoized output jobId=${jobId}\n`);
            const saved = JSON.parse(job.llmOutputJson) as GenerateRecipeCandidatesOutput & { tasksScanned: number };
            return saved.tasksScanned;
        }

        this.notifier.publish({
            type: NOTIFICATION_TYPE.sdkJobUpdated,
            payload: { kind: "recipe-scan", status: "running", jobId },
        });

        const apiKey = await this.settings.getAnthropicApiKey();
        if (!apiKey) throw new MissingApiKeyError();
        const modelOverride = await this.settings.getAnthropicModel();
        const filters = parseRecipeScanFilters(job.filtersJson ?? "{}");
        const language = normalizeRecipeLanguage(job.language);

        process.stdout.write(`[recipe-scan] agent starting model=${modelOverride ?? "default"} maxCandidates=${filters.maxCandidates} language=${language}\n`);

        // 에이전트가 필요한 태스크를 자율적으로 조회한다. 사전에 전체를 로드하지 않는다.
        const toolServer = buildRecipeScanTools(this.taskQuery, this.taskSummary, this.eventRead);

        const idempotencyKey = `${ctx.info.workflowExecution?.workflowId ?? "wf"}-${ctx.info.activityId}`;

        const hb = setInterval(() => Context.current().heartbeat(), 10_000);
        const agentStart = Date.now();
        let output;
        try {
            output = await this.agent.generate({
                ...(apiKey ? { apiKey } : {}),
                ...(modelOverride ? { model: modelOverride } : {}),
                maxCandidates: filters.maxCandidates,
                language,
                archivedScope: filters.archivedScope,
                minEventCount: filters.minEventCount,
                idempotencyKey,
                abortSignal: ctx.cancellationSignal,
                toolServer,
            });
            process.stdout.write(`[recipe-scan] agent done durationMs=${Date.now() - agentStart} turns=${output.numTurns ?? "?"} recipes=${output.recipes.length}\n`);
        } catch (err) {
            process.stderr.write(`[recipe-scan] agent error after ${Date.now() - agentStart}ms: ${err instanceof Error ? err.message : String(err)}\n`);
            throw err;
        } finally {
            clearInterval(hb);
        }

        const tasksScanned = 0; // 에이전트가 직접 조회하므로 사전 집계 불필요

        await this.jobs.saveLlmOutput(
            jobId,
            JSON.stringify({ ...output, tasksScanned }),
            new Date().toISOString(),
        );

        return tasksScanned;
    }

    // insert 단계: 저장된 LLM 응답으로 후보를 등록한다. 재시도 시 중복 삽입을 건너뛴다.
    async insertRecipeCandidates(jobId: string): Promise<number> {
        const job = await this.loadJob(jobId);
        if (!job.llmOutputJson) throw new Error(`memoized LLM output missing for job ${jobId}`);

        const memo = JSON.parse(job.llmOutputJson) as GenerateRecipeCandidatesOutput & { tasksScanned: number };
        if (memo.recipes.length === 0) return 0;

        const alreadyInserted = await this.candidates.countByJobId(jobId);
        if (alreadyInserted > 0) return alreadyInserted;

        const knownTasks = await this.taskQuery.findAll("all");
        const knownTaskIds = new Set(knownTasks.map((t) => t.id));
        const now = new Date().toISOString();

        const activeRecipes = await this.recipes.listByStatus("active");
        const activeRecipeTaskIds = activeRecipes.map((r) => ({
            recipe: r,
            taskIds: extractTaskIdsFromSlices(r.contributingSlicesJson),
        }));

        const rows: InsertRecipeCandidateRow[] = [];
        for (const recipe of memo.recipes) {
            const validSlices = recipe.contributing_slices.filter((s) => knownTaskIds.has(s.taskId));
            if (validSlices.length === 0) continue;

            const candidateTaskIds = new Set(validSlices.map((s) => s.taskId));
            const parent = pickBestParent(candidateTaskIds, activeRecipeTaskIds);

            rows.push({
                id: randomUUID(),
                jobId,
                title: recipe.title,
                intent: recipe.intent,
                description: recipe.description,
                summaryMd: recipe.summary_md,
                stepsJson: JSON.stringify(recipe.steps),
                touchedFilesJson: JSON.stringify(recipe.touched_files),
                contributingSlicesJson: JSON.stringify(
                    validSlices.map((s) => ({ taskId: s.taskId, eventIds: s.eventIds })),
                ),
                rationale: recipe.rationale,
                language: job.language,
                parentRecipeId: parent?.id ?? null,
                createdAt: now,
            });
        }

        await this.candidates.insertMany(rows);
        return rows.length;
    }

    // retire 단계: 만료된 레시피를 은퇴 처리한다. insertRecipeCandidates와 독립 재시도된다.
    async retireStaleRecipes(): Promise<void> {
        const activeRecipes = await this.recipes.listByStatus("active");
        await this.runRetirePolicy(activeRecipes, new Date().toISOString());
    }

    // complete 단계: 통계 기록 후 완료 알림. 재시도 시 멱등.
    async completeRecipeScan(
        jobId: string,
        candidatesCreated: number,
        tasksScanned: number,
    ): Promise<void> {
        const job = await this.loadJob(jobId);
        if (job.status === JOB_STATUS.completed) return;
        if (!job.llmOutputJson) throw new Error(`memoized LLM output missing for job ${jobId}`);

        const memo = JSON.parse(job.llmOutputJson) as GenerateRecipeCandidatesOutput & { tasksScanned: number };

        await this.jobs.markCompleted({
            id: jobId,
            candidatesCreated,
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
                kind: "recipe-scan",
                status: "succeeded",
                jobId,
                summary:
                    candidatesCreated === 0
                        ? `No recipe candidates from ${tasksScanned} tasks`
                        : `${candidatesCreated} recipe ${candidatesCreated === 1 ? "candidate" : "candidates"} from ${tasksScanned} tasks`,
                durationMs: memo.durationMs,
            },
        });
    }

    async failRecipeScan(jobId: string, error: string): Promise<void> {
        const job = await this.jobs.findById(jobId);
        if (job?.status === JOB_STATUS.failed) return;
        await this.jobs.incrementAndMarkFailed({
            id: jobId,
            error: truncate(error, 1000),
            completedAt: new Date().toISOString(),
        });
        this.notifier.publish({
            type: NOTIFICATION_TYPE.sdkJobUpdated,
            payload: {
                kind: "recipe-scan",
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

    private async runRetirePolicy(active: readonly RecipeEntity[], nowIso: string): Promise<void> {
        for (const r of active) {
            if (!r.shouldRetire(nowIso)) continue;
            await this.recipes.setStatus(r.id, "retired", nowIso);
        }
    }
}

function truncate(s: string, n: number): string {
    return s.length <= n ? s : s.slice(0, n) + "...";
}
