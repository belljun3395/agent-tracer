import {monitorUserHeaders, resolveMonitorIdentity} from "~runtime/config/monitor.identity.js";
import {EvaluateTurnUsecase} from "~runtime/domain/guardrail/application/evaluate.turn.usecase.js";
import {RefreshRulesUsecase} from "~runtime/domain/guardrail/application/refresh.rules.usecase.js";
import {HttpRuleSourceAdapter} from "~runtime/domain/guardrail/adapter/http.rule.source.adapter.js";
import type {GuardrailHook} from "~runtime/domain/guardrail/inbound/guardrail.hook.js";
import {ComputeHintsUsecase} from "~runtime/domain/hint/application/compute.hints.usecase.js";
import type {HintHook} from "~runtime/domain/hint/inbound/hint.hook.js";
import {FileBindingStoreAdapter} from "~runtime/domain/binding/adapter/file.binding.store.adapter.js";
import {FindActiveBindingUsecase} from "~runtime/domain/binding/application/find.active.binding.usecase.js";
import {SpoolEventSinkAdapter} from "~runtime/domain/ingest/adapter/spool.event.sink.adapter.js";
import type {IdGeneratorPort} from "~runtime/domain/ingest/port/id.generator.port.js";
import {HttpMemoSearchAdapter} from "~runtime/domain/memo/adapter/http.memo.search.adapter.js";
import {HttpMemoWriteAdapter} from "~runtime/domain/memo/adapter/http.memo.write.adapter.js";
import {CreateMemoUsecase} from "~runtime/domain/memo/application/create.memo.usecase.js";
import {SearchMemosUsecase} from "~runtime/domain/memo/application/search.memos.usecase.js";
import type {MemoHook} from "~runtime/domain/memo/inbound/memo.hook.js";
import {HttpRecipeCacheAdapter} from "~runtime/domain/recipe/adapter/http.recipe.cache.adapter.js";
import {HttpRecipeOutcomeReportAdapter} from "~runtime/domain/recipe/adapter/http.recipe.outcome.report.adapter.js";
import {HttpRecipeScanJobAdapter} from "~runtime/domain/recipe/adapter/http.recipe.scan.job.adapter.js";
import {BuildRecipeContextUsecase} from "~runtime/domain/recipe/application/build.recipe.context.usecase.js";
import {RefreshRecipeCacheUsecase} from "~runtime/domain/recipe/application/refresh.recipe.cache.usecase.js";
import {ReportRecipeOutcomeUsecase} from "~runtime/domain/recipe/application/report.recipe.outcome.usecase.js";
import {RequestRecipeScanUsecase} from "~runtime/domain/recipe/application/request.recipe.scan.usecase.js";
import type {RecipeHook} from "~runtime/domain/recipe/inbound/recipe.hook.js";
import {AgentRuleGeneratorAdapter} from "~runtime/domain/rulegen/adapter/agent.rule.generator.adapter.js";
import {ClaudeRuleAgentRunnerAdapter} from "~runtime/domain/rulegen/adapter/claude.rule.agent.runner.adapter.js";
import {HttpRuleEvidenceAdapter} from "~runtime/domain/rulegen/adapter/http.rule.evidence.adapter.js";
import {HttpRuleJobAdapter} from "~runtime/domain/rulegen/adapter/http.rule.job.adapter.js";
import {HttpRuleSettingAdapter} from "~runtime/domain/rulegen/adapter/http.rule.setting.adapter.js";
import {EnqueueRuleJobUsecase} from "~runtime/domain/rulegen/application/enqueue.rule.job.usecase.js";
import {PollRuleJobsUsecase} from "~runtime/domain/rulegen/application/poll.rule.jobs.usecase.js";
import {RefreshRuleSettingUsecase} from "~runtime/domain/rulegen/application/refresh.rule.setting.usecase.js";
import {RunRuleJobUsecase} from "~runtime/domain/rulegen/application/run.rule.job.usecase.js";
import type {RulegenHook} from "~runtime/domain/rulegen/inbound/rulegen.hook.js";
import {RuleGenerationSettingCache} from "~runtime/domain/rulegen/model/rule.command.model.js";
import type {SchedulerPort} from "~runtime/domain/rulegen/port/scheduler.port.js";
import type {RecipeCachePort} from "~runtime/domain/recipe/port/recipe.cache.port.js";
import {SetTaskTitleUsecase} from "~runtime/domain/session/application/set.task.title.usecase.js";
import {generateUlid} from "~runtime/support/ulid.js";

/** 데몬이 부르는 도메인 진입점 묶음 전체다. */
export interface DaemonHooks {
    readonly guardrail: GuardrailHook;
    readonly hint: HintHook;
    readonly recipe: RecipeHook;
    readonly rulegen: RulegenHook;
    readonly recipeCache: RecipeCachePort;
    readonly findActiveBinding: FindActiveBindingUsecase;
    readonly setTaskTitle: SetTaskTitleUsecase;
    readonly memo: MemoHook;
}

/** 데몬 프로세스가 쓰는 어댑터와 유스케이스를 한 곳에서 조립한다. */
export function composeDaemonHooks(leaseOwner: string): DaemonHooks {
    const identity = resolveMonitorIdentity();
    const baseUrl = identity.baseUrl;
    const headers = monitorUserHeaders(identity);

    const clock = {now: (): number => Date.now()};
    const scheduler: SchedulerPort = {
        every: (intervalMs, run) => {
            const timer = setInterval(run, intervalMs);
            // 하트비트가 프로세스 종료를 막지 않게 한다.
            timer.unref();
            return () => clearInterval(timer);
        },
    };

    const ruleSource = new HttpRuleSourceAdapter(baseUrl, headers);
    const guardrail: GuardrailHook = {
        evaluateTurn: new EvaluateTurnUsecase(ruleSource),
        refreshRules: new RefreshRulesUsecase(ruleSource),
    };

    const hint: HintHook = {computeHints: new ComputeHintsUsecase(clock)};

    const recipeCache = new HttpRecipeCacheAdapter(baseUrl, headers);
    const recipe: RecipeHook = {
        refreshCache: new RefreshRecipeCacheUsecase(recipeCache),
        buildContext: new BuildRecipeContextUsecase(recipeCache),
        requestScan: new RequestRecipeScanUsecase(new HttpRecipeScanJobAdapter(baseUrl, headers)),
        reportOutcome: new ReportRecipeOutcomeUsecase(new HttpRecipeOutcomeReportAdapter(baseUrl, headers)),
    };

    const findActiveBinding = new FindActiveBindingUsecase(new FileBindingStoreAdapter());
    const ids: IdGeneratorPort = {next: generateUlid};
    const setTaskTitle = new SetTaskTitleUsecase(new SpoolEventSinkAdapter(), ids, clock);

    const memo: MemoHook = {
        createMemo: new CreateMemoUsecase(new HttpMemoWriteAdapter(baseUrl, headers)),
        searchMemos: new SearchMemosUsecase(new HttpMemoSearchAdapter(baseUrl, headers)),
    };

    const jobs = new HttpRuleJobAdapter(baseUrl, headers, leaseOwner);
    const runRuleJob = new RunRuleJobUsecase(
        new HttpRuleEvidenceAdapter(baseUrl, headers),
        new AgentRuleGeneratorAdapter(new ClaudeRuleAgentRunnerAdapter()),
        jobs,
        clock,
    );
    const ruleSettingCache = new RuleGenerationSettingCache();
    const rulegen: RulegenHook = {
        pollJobs: new PollRuleJobsUsecase(
            jobs,
            (request, signal) => runRuleJob.execute(request, signal),
            scheduler,
        ),
        refreshSetting: new RefreshRuleSettingUsecase(
            new HttpRuleSettingAdapter(baseUrl, headers),
            ruleSettingCache,
        ),
        enqueueRuleJob: new EnqueueRuleJobUsecase(jobs, ruleSettingCache),
    };

    return {guardrail, hint, recipe, rulegen, recipeCache, findActiveBinding, setTaskTitle, memo};
}
