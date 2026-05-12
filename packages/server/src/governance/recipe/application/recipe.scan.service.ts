import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { RecipeScanAgent } from "~adapters/llm/recipe.scan.agent.js";
import type {
    RecipeOutputLanguage,
    RecipeTaskSnapshot,
} from "~adapters/llm/recipe.scan.prompt.js";
import { APP_SETTING_KEYS } from "~governance/settings/domain/app.setting.keys.js";
import { AppSettingService } from "~governance/settings/application/app.setting.service.js";
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
import type {
    EnqueueRecipeScanInput,
    RecipeScanFiltersSnapshot,
} from "./dto/recipe.scan.dto.js";

const DEFAULT_MAX_CANDIDATES = 10;
const MAX_CANDIDATES_HARD_CAP = 30;
const DEFAULT_MIN_EVENT_COUNT = 1;
const SUPPORTED_LANGUAGES: ReadonlySet<RecipeOutputLanguage> = new Set([
    "auto",
    "ko",
    "en",
    "ja",
    "zh",
]);

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
    ) {}

    async enqueue(
        input: EnqueueRecipeScanInput = {},
    ): Promise<RecipeScanJobEntity> {
        const existing = await this.jobs.findActive();
        if (existing) {
            throw new RecipeScanAlreadyInFlightError(existing.id);
        }

        const apiKey = await this.settings.getAnthropicApiKey();
        if (!apiKey) {
            throw new MissingApiKeyError();
        }

        const filters = normalizeFilters(input);
        // Validate there's at least one task matching before opening a job —
        // mirrors task-cleanup's NoTasksToScanError preflight.
        const tasks = await this.taskQuery.findAll(filters.archivedScope);
        const filtered = applyFilters(tasks, filters);
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
        try {
            const apiKey = await this.settings.getAnthropicApiKey();
            if (!apiKey) throw new MissingApiKeyError();

            const modelOverride = await this.settings.getAnthropicModel();
            const filters = parseFilters(job.filtersJson);
            const language = normalizeLanguage(job.language);

            const allTasks = await this.taskQuery.findAll(filters.archivedScope);
            const filtered = applyFilters(allTasks, filters);

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
                return;
            }

            const output = await this.agent.generate({
                apiKey,
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
                taskIds: extractTaskIds(r.contributingSlicesJson),
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
        }
    }

    private async resolveLanguage(): Promise<RecipeOutputLanguage> {
        const raw = await this.settings.getRawValue(
            APP_SETTING_KEYS.claudeOutputLanguage,
        );
        return normalizeLanguage(raw);
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
        const nowMs = Date.parse(nowIso);
        const STALE_AGE_MS = 14 * 24 * 60 * 60 * 1000;
        const MIN_APPLIED_FOR_FAILURE = 5;
        const MIN_SUCCESS_RATE = 0.3;

        for (const r of active) {
            const successRate =
                r.appliedCount > 0 ? r.successCount / r.appliedCount : 0;
            const ageMs = nowMs - Date.parse(r.createdAt);
            const failsByFailure =
                r.appliedCount >= MIN_APPLIED_FOR_FAILURE &&
                successRate < MIN_SUCCESS_RATE;
            const failsByStaleness =
                r.appliedCount === 0 && ageMs > STALE_AGE_MS;
            if (failsByFailure || failsByStaleness) {
                await this.recipes.setStatus(r.id, "retired", nowIso);
                this.logger.log(
                    `Auto-retired recipe ${r.id} (applied=${r.appliedCount}, success=${r.successCount}, age_ms=${ageMs})`,
                );
            }
        }
    }
}

function extractTaskIds(slicesJson: string): Set<string> {
    const out = new Set<string>();
    try {
        const parsed = JSON.parse(slicesJson) as unknown;
        if (!Array.isArray(parsed)) return out;
        for (const item of parsed) {
            if (!item || typeof item !== "object") continue;
            const rec = item as Record<string, unknown>;
            if (typeof rec.taskId === "string") out.add(rec.taskId);
        }
    } catch {
        // ignore — corrupt slice json just yields an empty set
    }
    return out;
}

const PARENT_OVERLAP_THRESHOLD = 0.5;

function pickBestParent(
    candidateTaskIds: ReadonlySet<string>,
    actives: readonly {
        readonly recipe: RecipeEntity;
        readonly taskIds: ReadonlySet<string>;
    }[],
): RecipeEntity | null {
    let bestRecipe: RecipeEntity | null = null;
    let bestRatio = PARENT_OVERLAP_THRESHOLD;
    for (const { recipe, taskIds } of actives) {
        if (taskIds.size === 0) continue;
        let overlap = 0;
        for (const id of candidateTaskIds) {
            if (taskIds.has(id)) overlap += 1;
        }
        if (overlap === 0) continue;
        // Jaccard overlap.
        const denom = candidateTaskIds.size + taskIds.size - overlap;
        const ratio = denom > 0 ? overlap / denom : 0;
        if (ratio > bestRatio) {
            bestRatio = ratio;
            bestRecipe = recipe;
        }
    }
    return bestRecipe;
}

function normalizeFilters(
    input: EnqueueRecipeScanInput,
): RecipeScanFiltersSnapshot {
    return {
        statusFilter: input.statusFilter ?? "completed",
        since: input.since ?? null,
        maxCandidates: clampMaxCandidates(input.maxCandidates),
        minEventCount: clampMinEventCount(input.minEventCount),
        archivedScope: input.archivedScope ?? "active",
    };
}

function parseFilters(raw: string): RecipeScanFiltersSnapshot {
    try {
        const parsed = JSON.parse(raw) as Partial<RecipeScanFiltersSnapshot>;
        return {
            statusFilter: parsed.statusFilter ?? "completed",
            since: parsed.since ?? null,
            maxCandidates: clampMaxCandidates(parsed.maxCandidates),
            minEventCount: clampMinEventCount(parsed.minEventCount),
            archivedScope: parsed.archivedScope ?? "active",
        };
    } catch {
        return normalizeFilters({});
    }
}

function clampMaxCandidates(raw: unknown): number {
    const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_CANDIDATES;
    return Math.min(Math.max(Math.floor(n), 1), MAX_CANDIDATES_HARD_CAP);
}

function clampMinEventCount(raw: unknown): number {
    const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_MIN_EVENT_COUNT;
    return Math.max(Math.floor(n), 1);
}

function applyFilters<T extends { readonly status: string; readonly updatedAt: string }>(
    tasks: readonly T[],
    filters: RecipeScanFiltersSnapshot,
): readonly T[] {
    return tasks.filter((t) => {
        if (filters.statusFilter !== "all") {
            if (filters.statusFilter === "completed" && t.status !== "completed") {
                return false;
            }
            if (
                filters.statusFilter === "active" &&
                t.status !== "running" &&
                t.status !== "waiting"
            ) {
                return false;
            }
        }
        if (filters.since && t.updatedAt < filters.since) return false;
        return true;
    });
}

function normalizeLanguage(raw: string | null): RecipeOutputLanguage {
    if (!raw) return "auto";
    const trimmed = raw.trim().toLowerCase() as RecipeOutputLanguage;
    return SUPPORTED_LANGUAGES.has(trimmed) ? trimmed : "auto";
}

function truncate(s: string, n: number): string {
    return s.length <= n ? s : s.slice(0, n) + "...";
}
