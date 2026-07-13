import {monitorUserHeader, resolveMonitorBaseUrl} from "~runtime/config/env.js";
import {EvaluatePreToolUsecase} from "~runtime/domain/guardrail/application/evaluate.pre-tool.usecase.js";
import {EvaluateTurnUsecase} from "~runtime/domain/guardrail/application/evaluate.turn.usecase.js";
import {RefreshRulesUsecase} from "~runtime/domain/guardrail/application/refresh.rules.usecase.js";
import {HttpRuleSourceAdapter} from "~runtime/domain/guardrail/adapter/http.rule.source.adapter.js";
import type {GuardrailHook} from "~runtime/domain/guardrail/inbound/guardrail.hook.js";
import {ComputeHintsUsecase} from "~runtime/domain/hint/application/compute.hints.usecase.js";
import type {HintHook} from "~runtime/domain/hint/inbound/hint.hook.js";
import {HttpRecipeCacheAdapter} from "~runtime/domain/recipe/adapter/http.recipe.cache.adapter.js";
import {HttpRecipeScanJobAdapter} from "~runtime/domain/recipe/adapter/http.recipe.scan.job.adapter.js";
import {BuildRecipeContextUsecase} from "~runtime/domain/recipe/application/build.recipe.context.usecase.js";
import {RefreshRecipeCacheUsecase} from "~runtime/domain/recipe/application/refresh.recipe.cache.usecase.js";
import {RequestRecipeScanUsecase} from "~runtime/domain/recipe/application/request.recipe.scan.usecase.js";
import type {RecipeHook} from "~runtime/domain/recipe/inbound/recipe.hook.js";
import {AgentRuleGeneratorAdapter} from "~runtime/domain/rulegen/adapter/agent.rule.generator.adapter.js";
import {HttpRuleEvidenceAdapter} from "~runtime/domain/rulegen/adapter/http.rule.evidence.adapter.js";
import {HttpRuleJobAdapter} from "~runtime/domain/rulegen/adapter/http.rule.job.adapter.js";
import {HttpRuleSettingAdapter} from "~runtime/domain/rulegen/adapter/http.rule.setting.adapter.js";
import {EnqueueAutoRuleUsecase} from "~runtime/domain/rulegen/application/enqueue.auto.rule.usecase.js";
import {PollRuleJobsUsecase} from "~runtime/domain/rulegen/application/poll.rule.jobs.usecase.js";
import {RefreshAutoTriggerUsecase} from "~runtime/domain/rulegen/application/refresh.auto.trigger.usecase.js";
import {RunRuleJobUsecase} from "~runtime/domain/rulegen/application/run.rule.job.usecase.js";
import type {RulegenHook} from "~runtime/domain/rulegen/inbound/rulegen.hook.js";
import {AutoTriggerSettingCache} from "~runtime/domain/rulegen/model/auto.trigger.model.js";
import type {RecipeCachePort} from "~runtime/domain/recipe/port/recipe.cache.port.js";

/** 데몬이 부르는 도메인 진입점 묶음 전체다. */
export interface DaemonHooks {
    readonly guardrail: GuardrailHook;
    readonly hint: HintHook;
    readonly recipe: RecipeHook;
    readonly rulegen: RulegenHook;
    readonly recipeCache: RecipeCachePort;
}

/** 데몬 프로세스가 쓰는 어댑터와 유스케이스를 한 곳에서 조립한다. */
export function composeDaemonHooks(leaseOwner: string): DaemonHooks {
    const baseUrl = resolveMonitorBaseUrl();
    const headers = monitorUserHeader();

    const guardrail: GuardrailHook = {
        evaluateTurn: new EvaluateTurnUsecase(),
        evaluatePreTool: new EvaluatePreToolUsecase(),
        refreshRules: new RefreshRulesUsecase(new HttpRuleSourceAdapter(baseUrl, headers)),
    };

    const hint: HintHook = {computeHints: new ComputeHintsUsecase()};

    const recipeCache = new HttpRecipeCacheAdapter(baseUrl, headers);
    const recipe: RecipeHook = {
        refreshCache: new RefreshRecipeCacheUsecase(recipeCache),
        buildContext: new BuildRecipeContextUsecase(recipeCache),
        requestScan: new RequestRecipeScanUsecase(new HttpRecipeScanJobAdapter(baseUrl, headers)),
    };

    const jobs = new HttpRuleJobAdapter(baseUrl, headers, leaseOwner);
    const runRuleJob = new RunRuleJobUsecase(
        new HttpRuleEvidenceAdapter(baseUrl, headers),
        new AgentRuleGeneratorAdapter(),
        jobs,
    );
    const autoTriggerCache = new AutoTriggerSettingCache();
    const rulegen: RulegenHook = {
        pollJobs: new PollRuleJobsUsecase(
            jobs,
            (request, signal) => runRuleJob.execute(request, signal),
        ),
        refreshAutoTrigger: new RefreshAutoTriggerUsecase(
            new HttpRuleSettingAdapter(baseUrl, headers),
            autoTriggerCache,
        ),
        enqueueAutoRule: new EnqueueAutoRuleUsecase(jobs, autoTriggerCache),
    };

    return {guardrail, hint, recipe, rulegen, recipeCache};
}
