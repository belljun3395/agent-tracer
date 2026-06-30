import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { APP_SETTINGS } from "@monitor/identity-api/settings/public/tokens.js";
import { APP_SETTING_KEYS } from "@monitor/identity-api/settings/domain/app.setting.keys.js";
import type { IAppSettings } from "@monitor/identity-api/settings/public/iservice/app.settings.iservice.js";
import { TASK_SNAPSHOT_QUERY } from "@monitor/run-api/public/task/tokens.js";
import type { ITaskSnapshotQuery } from "@monitor/run-api/public/task/iservice/task.snapshot.query.iservice.js";
import {
    normalizeRecipeScanFilters,
    applyRecipeScanFilters,
    normalizeRecipeLanguage,
} from "../domain/recipe.scan.filters.policy.js";
import {
    MissingApiKeyError,
    NoTasksToScanError,
    RecipeScanAlreadyInFlightError,
} from "../domain/recipe.scan.errors.js";
import { InsightJobRepository } from "../../job/insight.job.repository.js";
import type { InsightJobEntity } from "../../job/insight.job.entity.js";
import type { EnqueueRecipeScanInput } from "../application/dto/recipe.scan.dto.js";

@Injectable()
export class RecipeScanService {
    constructor(
        private readonly jobs: InsightJobRepository,
        @Inject(APP_SETTINGS) private readonly settings: IAppSettings,
        @Inject(TASK_SNAPSHOT_QUERY) private readonly taskQuery: ITaskSnapshotQuery,
    ) {}

    async enqueue(input: EnqueueRecipeScanInput = {}): Promise<InsightJobEntity> {
        const existing = await this.jobs.findActive("recipe_scan");
        if (existing) {
            // 레시피 스캔은 전체 태스크 집합을 읽으므로 동시에 하나만 허용한다.
            throw new RecipeScanAlreadyInFlightError(existing.id);
        }

        const apiKey = await this.settings.getAnthropicApiKey();
        if (!apiKey) throw new MissingApiKeyError();

        const filters = normalizeRecipeScanFilters(input);
        const tasks = await this.taskQuery.findAll(filters.archivedScope);
        const filtered = applyRecipeScanFilters(tasks, filters);
        if (filtered.length === 0) throw new NoTasksToScanError();

        const language = normalizeRecipeLanguage(
            await this.settings.getRawValue(APP_SETTING_KEYS.claudeOutputLanguage),
        );

        return this.jobs.insert({
            id: randomUUID(),
            jobType: "recipe_scan",
            filtersJson: JSON.stringify(filters),
            language,
            createdAt: new Date().toISOString(),
        });
    }

    findLatest(): Promise<InsightJobEntity | null> {
        return this.jobs.findLatest("recipe_scan");
    }

    findById(id: string): Promise<InsightJobEntity | null> {
        return this.jobs.findById(id);
    }
}
