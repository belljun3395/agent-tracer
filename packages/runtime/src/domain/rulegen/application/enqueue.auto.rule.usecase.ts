import {
    isAutoRuleGenerationTrigger,
    type AutoTriggerSettingCache,
} from "~runtime/domain/rulegen/model/auto.trigger.model.js";
import type {RuleJobPort} from "~runtime/domain/rulegen/port/rule.job.port.js";

/** 규칙 생성을 부르는 사용자 입력마다 태스크당 하나의 자동 잡을 넣는다. */
export class EnqueueAutoRuleUsecase {
    constructor(
        private readonly jobs: RuleJobPort,
        private readonly cache: AutoTriggerSettingCache,
    ) {}

    async execute(kind: string, taskId: string, eventId: string, prompt: string): Promise<void> {
        const setting = this.cache.snapshot();
        if (!isAutoRuleGenerationTrigger(setting, kind, taskId, eventId, prompt)) return;
        try {
            if (await this.jobs.hasActiveJob(taskId)) return;
            await this.jobs.enqueue(taskId, eventId, setting.maxRulesPerTask);
        } catch (error) {
            process.stderr.write(`[rule-gen] auto-enqueue failed for task ${taskId}: ${String(error)}\n`);
        }
    }
}
