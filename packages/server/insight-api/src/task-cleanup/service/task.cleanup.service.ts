import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { APP_SETTINGS } from "@monitor/identity-api/settings/public/tokens.js";
import type { IAppSettings } from "@monitor/identity-api/settings/public/iservice/app.settings.iservice.js";
import { TASK_SNAPSHOT_QUERY } from "@monitor/run-api/public/task/tokens.js";
import type { ITaskSnapshotQuery } from "@monitor/run-api/public/task/iservice/task.snapshot.query.iservice.js";
import {
    GenerationAlreadyInFlightError,
    MissingApiKeyError,
    NoTasksToScanError,
} from "../domain/task.cleanup.errors.js";
import { InsightJobRepository } from "../../job/insight.job.repository.js";
import type { InsightJobEntity } from "../../job/insight.job.entity.js";

@Injectable()
export class TaskCleanupService {
    constructor(
        private readonly jobs: InsightJobRepository,
        @Inject(APP_SETTINGS) private readonly settings: IAppSettings,
        @Inject(TASK_SNAPSHOT_QUERY) private readonly taskQuery: ITaskSnapshotQuery,
    ) {}

    async enqueue(): Promise<InsightJobEntity> {
        const existing = await this.jobs.findActive("task_cleanup");
        if (existing) {
            // 정리 스캔은 워크스페이스 단위 결과라 동시에 하나만 실행한다.
            throw new GenerationAlreadyInFlightError(existing.id);
        }

        const apiKey = await this.settings.getAnthropicApiKey();
        if (!apiKey) throw new MissingApiKeyError();

        const tasks = await this.taskQuery.findAll("active");
        if (tasks.length === 0) throw new NoTasksToScanError();

        return this.jobs.insert({
            id: randomUUID(),
            jobType: "task_cleanup",
            createdAt: new Date().toISOString(),
        });
    }

    findLatest(): Promise<InsightJobEntity | null> {
        return this.jobs.findLatest("task_cleanup");
    }

    findById(id: string): Promise<InsightJobEntity | null> {
        return this.jobs.findById(id);
    }
}
