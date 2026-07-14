import type {EnqueueRuleJobUsecase} from "~runtime/domain/rulegen/application/enqueue.rule.job.usecase.js";
import type {PollRuleJobsUsecase} from "~runtime/domain/rulegen/application/poll.rule.jobs.usecase.js";
import type {RefreshRuleSettingUsecase} from "~runtime/domain/rulegen/application/refresh.rule.setting.usecase.js";

/** 규칙 생성 도메인이 데몬에 제공하는 진입점 묶음이다. */
export interface RulegenHook {
    readonly pollJobs: PollRuleJobsUsecase;
    readonly refreshSetting: RefreshRuleSettingUsecase;
    readonly enqueueRuleJob: EnqueueRuleJobUsecase;
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

export function onRuleGenerationSettingRefresh(hook: RulegenHook): Promise<number> {
    return hook.refreshSetting.execute();
}

export function onUserInputForRuleGeneration(
    hook: RulegenHook,
    kind: string,
    taskId: string,
    eventId: string,
    prompt: string,
): Promise<void> {
    return hook.enqueueRuleJob.execute(kind, taskId, eventId, prompt);
}
