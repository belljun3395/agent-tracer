import {
    isRuleGenerationTrigger,
    type RuleGenerationSettingCache,
} from "~runtime/domain/rulegen/model/rule.command.model.js";
import type {RuleJobPort} from "~runtime/domain/rulegen/port/rule.job.port.js";

/** 규칙 생성을 부르는 사용자 입력마다 태스크당 하나의 잡을 넣는다. */
export class EnqueueRuleJobUsecase {
    constructor(
        private readonly jobs: RuleJobPort,
        private readonly cache: RuleGenerationSettingCache,
    ) {}

    async execute(kind: string, taskId: string, eventId: string, prompt: string): Promise<void> {
        if (!isRuleGenerationTrigger(kind, taskId, eventId, prompt)) return;
        try {
            if (await this.jobs.hasActiveJob(taskId)) return;
            await this.jobs.enqueue(taskId, eventId, this.cache.snapshot());
        } catch (error) {
            process.stderr.write(`[rule-gen] enqueue failed for task ${taskId}: ${String(error)}\n`);
        }
    }
}
