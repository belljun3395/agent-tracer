import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ITaskSummary } from "@monitor/run-api/public/task/iservice/task.summary.iservice.js";
import { TASK_SUMMARY } from "@monitor/run-api/public/task/tokens.js";
import { RuleJobRepository } from "../../repository/job/rule.job.repository.js";
import type { RuleJobEntity } from "../../repository/job/rule.job.entity.js";
import {
    GenerationAlreadyInFlightError,
    TaskHasNoEventsError,
    TaskNotFoundForGenerationError,
} from "../../domain/generation/task.rule.generation.errors.js";

// 규칙 생성 잡의 인테이크와 조회만 담당한다. 실행(추론·적용·알림)은 워커가 소유한다.
@Injectable()
export class TaskRuleGenerationService {
    constructor(
        private readonly jobs: RuleJobRepository,
        @Inject(TASK_SUMMARY) private readonly taskSummary: ITaskSummary,
    ) {}

    async enqueue(taskId: string): Promise<RuleJobEntity> {
        const { summary } = await this.taskSummary.execute({ taskId });
        if (!summary) {
            throw new TaskNotFoundForGenerationError(taskId);
        }
        if (summary.eventCount === 0) {
            throw new TaskHasNoEventsError(taskId);
        }
        const existing = await this.jobs.findActiveForTask("rule_generation", taskId);
        if (existing) {
            throw new GenerationAlreadyInFlightError(existing.id);
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
