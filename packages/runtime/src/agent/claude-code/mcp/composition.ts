/** MCP 서버 프로세스가 도구 호출을 직접 처리하는 데 쓰는 어댑터와 유스케이스를 한 곳에서 조립한다. */
import {CLAUDE_RUNTIME_SOURCE} from "~runtime/config/env.js";
import {monitorUserHeaders, resolveMonitorIdentity} from "~runtime/config/monitor.identity.js";
import {FileBindingStoreAdapter} from "~runtime/domain/binding/adapter/file.binding.store.adapter.js";
import {ReadBindingUsecase} from "~runtime/domain/binding/application/read.binding.usecase.js";
import {AppendEventsUsecase} from "~runtime/domain/ingest/application/append.events.usecase.js";
import {SpoolEventSinkAdapter} from "~runtime/domain/ingest/adapter/spool.event.sink.adapter.js";
import type {IdGeneratorPort} from "~runtime/domain/ingest/port/id.generator.port.js";
import {HttpMemoSearchAdapter} from "~runtime/domain/memo/adapter/http.memo.search.adapter.js";
import {HttpMemoWriteAdapter} from "~runtime/domain/memo/adapter/http.memo.write.adapter.js";
import {CreateMemoUsecase} from "~runtime/domain/memo/application/create.memo.usecase.js";
import {SearchMemosUsecase} from "~runtime/domain/memo/application/search.memos.usecase.js";
import type {MemoHook} from "~runtime/domain/memo/inbound/memo.hook.js";
import {FileRecipePendingMarkAdapter} from "~runtime/domain/recipe/adapter/file.recipe.pending.mark.adapter.js";
import {HttpRecipeFetchAdapter} from "~runtime/domain/recipe/adapter/http.recipe.fetch.adapter.js";
import {HttpRecipeOutcomeReportAdapter} from "~runtime/domain/recipe/adapter/http.recipe.outcome.report.adapter.js";
import {HttpRecipeScanJobAdapter} from "~runtime/domain/recipe/adapter/http.recipe.scan.job.adapter.js";
import {HttpRecipeSearchAdapter} from "~runtime/domain/recipe/adapter/http.recipe.search.adapter.js";
import {ClearRecipeMarkUsecase} from "~runtime/domain/recipe/application/clear.recipe.mark.usecase.js";
import {GetRecipeUsecase} from "~runtime/domain/recipe/application/get.recipe.usecase.js";
import {MarkRecipeOpenedUsecase} from "~runtime/domain/recipe/application/mark.recipe.opened.usecase.js";
import {ReadPendingRecipeMarkUsecase} from "~runtime/domain/recipe/application/read.pending.recipe.mark.usecase.js";
import {ReportRecipeOutcomeUsecase} from "~runtime/domain/recipe/application/report.recipe.outcome.usecase.js";
import {RequestRecipeScanUsecase} from "~runtime/domain/recipe/application/request.recipe.scan.usecase.js";
import {SearchRecipesUsecase} from "~runtime/domain/recipe/application/search.recipes.usecase.js";
import type {RecipeHook, RecipeOutcomeMarkHook} from "~runtime/domain/recipe/inbound/recipe.hook.js";
import {HttpTaskRenameAdapter} from "~runtime/domain/session/adapter/http.task.rename.adapter.js";
import {SetTaskTitleUsecase} from "~runtime/domain/session/application/set.task.title.usecase.js";
import type {SetTaskTitleHook} from "~runtime/domain/session/inbound/session.hook.js";
import {generateUlid} from "~runtime/support/ulid.js";

const identity = resolveMonitorIdentity();
const baseUrl = identity.baseUrl;
const headers = monitorUserHeaders(identity);
const clock = {now: (): number => Date.now()};
const ids: IdGeneratorPort = {next: generateUlid};

const recipe: RecipeHook = {
    getRecipe: new GetRecipeUsecase(new HttpRecipeFetchAdapter(baseUrl, headers)),
    requestScan: new RequestRecipeScanUsecase(new HttpRecipeScanJobAdapter(baseUrl, headers)),
    reportOutcome: new ReportRecipeOutcomeUsecase(new HttpRecipeOutcomeReportAdapter(baseUrl, headers)),
    searchRecipes: new SearchRecipesUsecase(new HttpRecipeSearchAdapter(baseUrl, headers)),
};

const recipeOutcomeMark: RecipeOutcomeMarkHook = {
    markOpened: new MarkRecipeOpenedUsecase(new FileRecipePendingMarkAdapter(), clock),
    clearMark: new ClearRecipeMarkUsecase(new FileRecipePendingMarkAdapter()),
    readPendingMark: new ReadPendingRecipeMarkUsecase(new FileRecipePendingMarkAdapter(), clock),
};

const memo: MemoHook = {
    createMemo: new CreateMemoUsecase(new HttpMemoWriteAdapter(baseUrl, headers)),
    searchMemos: new SearchMemosUsecase(new HttpMemoSearchAdapter(baseUrl, headers)),
};

const session: SetTaskTitleHook = {
    setTaskTitle: new SetTaskTitleUsecase(new HttpTaskRenameAdapter(baseUrl, headers)),
};

/** MCP 도구가 자기 세션의 바인딩을 스스로 찾을 때 쓴다. */
export const readBinding = new ReadBindingUsecase(new FileBindingStoreAdapter());

/** get_recipe가 recipeInjected 이벤트를 훅과 같은 방식으로 스풀에 직접 남길 때 쓴다. */
export const appendIngestEvents = new AppendEventsUsecase(
    new SpoolEventSinkAdapter(),
    ids,
    clock,
    CLAUDE_RUNTIME_SOURCE,
);

/** MCP 서버 프로세스 하나가 쓰는 유스케이스 묶음이다. */
export const mcpRuntime = {
    recipe,
    recipeOutcomeMark,
    memo,
    session,
} as const;
