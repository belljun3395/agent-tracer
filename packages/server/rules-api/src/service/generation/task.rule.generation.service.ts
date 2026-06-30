import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ITimelineEventRead } from "@monitor/timeline-api/public/event/iservice/timeline.event.read.iservice.js";
import { TIMELINE_EVENT_READ } from "@monitor/timeline-api/public/event/tokens.js";
import { RuleJobRepository } from "../../repository/job/rule.job.repository.js";
import type { RuleJobEntity } from "../../domain/job/rule.job.entity.js";
import {
    GenerationAlreadyInFlightError,
    TaskHasNoEventsError,
} from "../../domain/generation/task.rule.generation.errors.js";

// 규칙 생성 잡의 인테이크와 조회만 담당한다. 실행(추론·적용·알림)은 워커가 소유한다.
@Injectable()
export class TaskRuleGenerationService {
    constructor(
        private readonly jobs: RuleJobRepository,
        @Inject(TIMELINE_EVENT_READ) private readonly events: ITimelineEventRead,
    ) {}

    async enqueue(taskId: string): Promise<RuleJobEntity> {
        // 이벤트가 없으면(존재하지 않는 태스크 포함) 생성할 근거가 없다.
        if ((await this.events.countByTaskId(taskId)) === 0) {
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
