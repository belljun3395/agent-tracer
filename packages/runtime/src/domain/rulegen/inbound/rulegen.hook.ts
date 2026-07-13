import type {EnqueueAutoRuleUsecase} from "~runtime/domain/rulegen/application/enqueue.auto.rule.usecase.js";
import type {PollRuleJobsUsecase} from "~runtime/domain/rulegen/application/poll.rule.jobs.usecase.js";
import type {RefreshAutoTriggerUsecase} from "~runtime/domain/rulegen/application/refresh.auto.trigger.usecase.js";
import type {AutoRuleGenerationSetting} from "~runtime/domain/rulegen/model/auto.trigger.model.js";

/** 규칙 생성 도메인이 데몬에 제공하는 진입점 묶음이다. */
export interface RulegenHook {
    readonly pollJobs: PollRuleJobsUsecase;
    readonly refreshAutoTrigger: RefreshAutoTriggerUsecase;
    readonly enqueueAutoRule: EnqueueAutoRuleUsecase;
}

export function onRuleGenerationPoll(hook: RulegenHook): Promise<void> {
    return hook.pollJobs.execute();
}

export function hasRunningRuleGenerationJobs(hook: RulegenHook): boolean {
    return hook.pollJobs.hasRunning();
}

export function releaseRunningRuleGenerationJobs(hook: RulegenHook): Promise<void> {
    return hook.pollJobs.releaseRunning();
}

export function onRuleGenerationSettingRefresh(hook: RulegenHook): Promise<AutoRuleGenerationSetting> {
    return hook.refreshAutoTrigger.execute();
}

export function onUserInputForRuleGeneration(
    hook: RulegenHook,
    kind: string,
    taskId: string,
    eventId: string,
    prompt: string,
): Promise<void> {
    return hook.enqueueAutoRule.execute(kind, taskId, eventId, prompt);
}
