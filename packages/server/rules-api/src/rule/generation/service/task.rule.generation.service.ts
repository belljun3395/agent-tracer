import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ITaskSummary } from "@monitor/run-api/task/public/iservice/task.summary.iservice.js";
import { TASK_SUMMARY } from "@monitor/run-api/task/public/tokens.js";
import { APP_SETTINGS } from "@monitor/identity-api/settings/public/tokens.js";
import type { IAppSettings } from "@monitor/identity-api/settings/public/iservice/app.settings.iservice.js";
import { RuleJobRepository } from "../../../job/rule.job.repository.js";
import type { RuleJobEntity } from "../../../job/rule.job.entity.js";
import {
    GenerationAlreadyInFlightError,
    MissingApiKeyError,
    TaskHasNoEventsError,
    TaskNotFoundForGenerationError,
} from "../domain/task.rule.generation.errors.js";

// 규칙 생성 잡의 인테이크와 조회만 담당한다. 실행(추론·적용·알림)은 워커가 소유한다.
@Injectable()
export class TaskRuleGenerationService {
    constructor(
        private readonly jobs: RuleJobRepository,
        @Inject(APP_SETTINGS) private readonly settings: IAppSettings,
        @Inject(TASK_SUMMARY) private readonly taskSummary: ITaskSummary,
    ) {}

    async enqueue(taskId: string): Promise<RuleJobEntity> {
        const { summary } = await this.taskSummary.execute({ taskId });
        if (!summary) {
            // 태스크가 없으면 생성 잡을 만들지 않고 요청을 실패시킨다.
            throw new TaskNotFoundForGenerationError(taskId);
        }
        if (summary.eventCount === 0) {
            // 이벤트가 없는 태스크는 학습할 규칙 근거가 없으므로 생성하지 않는다.
            throw new TaskHasNoEventsError(taskId);
        }
        const existing = await this.jobs.findActiveForTask("rule_generation", taskId);
        if (existing) {
            // 같은 태스크의 생성 잡은 동시에 하나만 허용한다.
            throw new GenerationAlreadyInFlightError(existing.id);
        }

        const apiKey = await this.settings.getAnthropicApiKey();
        if (!apiKey) {
            // 생성은 항상 키가 필요하다. 잡을 만들기 전에 거부한다.
            throw new MissingApiKeyError();
        }

        return this.jobs.insert({
            id: randomUUID(),
            jobType: "rule_generation",
            taskId,
            createdAt: new Date().toISOString(),
        });
    }

    async findLatest(taskId: string): Promise<RuleJobEntity | null> {
        return this.jobs.findLatestForTask("rule_generation", taskId);
    }

    async findById(id: string): Promise<RuleJobEntity | null> {
        return this.jobs.findById(id);
    }
}
