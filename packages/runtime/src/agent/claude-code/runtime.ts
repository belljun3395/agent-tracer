import * as path from "node:path";
import {
    CLAUDE_RUNTIME_SOURCE,
    isVerboseLogging,
    resolveMonitorTransportConfig,
    resolveProjectDir,
} from "~runtime/config/env.js";
import {monitorUserHeaders, resolveMonitorIdentity} from "~runtime/config/monitor.identity.js";
import {createHookLogger, type HookLogger} from "~runtime/config/hook.log.js";
import {readStdinJson} from "~runtime/config/stdin.js";
import {ensureDaemonRunning} from "~runtime/daemon/ipc/hook.client.js";
import {FileBindingStoreAdapter} from "~runtime/domain/binding/adapter/file.binding.store.adapter.js";
import {ReadBindingUsecase} from "~runtime/domain/binding/application/read.binding.usecase.js";
import {ReleaseBindingUsecase} from "~runtime/domain/binding/application/release.binding.usecase.js";
import type {BindingHook} from "~runtime/domain/binding/inbound/binding.hook.js";
import {bindingKey} from "~runtime/domain/binding/model/binding.model.js";
import {FileTodoSnapshotAdapter} from "~runtime/domain/ingest/adapter/file.todo.snapshot.adapter.js";
import {FileToolTimingAdapter} from "~runtime/domain/ingest/adapter/file.tool.timing.adapter.js";
import {SpoolEventSinkAdapter} from "~runtime/domain/ingest/adapter/spool.event.sink.adapter.js";
import {AppendEventsUsecase} from "~runtime/domain/ingest/application/append.events.usecase.js";
import {MarkToolStartUsecase} from "~runtime/domain/ingest/application/mark.tool.start.usecase.js";
import {RecordTodoUsecase} from "~runtime/domain/ingest/application/record.todo.usecase.js";
import {RecordToolFailureUsecase} from "~runtime/domain/ingest/application/record.tool.failure.usecase.js";
import {RecordToolUseUsecase} from "~runtime/domain/ingest/application/record.tool.use.usecase.js";
import type {IngestHook} from "~runtime/domain/ingest/inbound/tool.hook.js";
import {defaultTaskTitle} from "~runtime/domain/ingest/model/workspace.path.model.js";
import type {IdGeneratorPort} from "~runtime/domain/ingest/port/id.generator.port.js";
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
import {ClearSessionUsecase} from "~runtime/domain/session/application/clear.session.usecase.js";
import {EndSessionUsecase} from "~runtime/domain/session/application/end.session.usecase.js";
import {EnsureSessionUsecase} from "~runtime/domain/session/application/ensure.session.usecase.js";
import {onSessionClear, onSessionStart, type SessionHook} from "~runtime/domain/session/inbound/session.hook.js";
import type {EnsuredSession} from "~runtime/domain/session/model/ensured.session.model.js";
import {subagentSessionId, subagentTitle} from "~runtime/domain/session/model/session.event.model.js";
import type {TaskKind} from "~runtime/domain/session/model/session.event.model.js";
import {CloseTurnUsecase} from "~runtime/domain/turn/application/close.turn.usecase.js";
import {OpenTurnUsecase} from "~runtime/domain/turn/application/open.turn.usecase.js";
import type {TurnHook} from "~runtime/domain/turn/inbound/turn.hook.js";
import type {JsonObject} from "~runtime/support/json.js";
import {generateUlid} from "~runtime/support/ulid.js";
import type {ReaderResult} from "~runtime/agent/claude-code/payload/field.payload.js";
import {findResumedSessionId} from "~runtime/agent/claude-code/transcript/transcript.resume.js";

const transport = resolveMonitorTransportConfig();
const headers = monitorUserHeaders(resolveMonitorIdentity());
const projectDir = resolveProjectDir();

const sink = new SpoolEventSinkAdapter();
const bindings = new FileBindingStoreAdapter();
const todoSnapshots = new FileTodoSnapshotAdapter(projectDir);
const toolTiming = new FileToolTimingAdapter(projectDir);
const recipeJobs = new HttpRecipeScanJobAdapter(transport.baseUrl, headers);
const shapeContext = {projectDir};
const ids: IdGeneratorPort = {next: generateUlid};
const clock = {now: (): number => Date.now()};

const ingest: IngestHook = {
    appendEvents: new AppendEventsUsecase(sink, ids, clock, CLAUDE_RUNTIME_SOURCE),
    recordToolUse: new RecordToolUseUsecase(sink, toolTiming, ids, clock, CLAUDE_RUNTIME_SOURCE, shapeContext),
    recordToolFailure: new RecordToolFailureUsecase(
        sink,
        toolTiming,
        ids,
        clock,
        CLAUDE_RUNTIME_SOURCE,
        shapeContext,
    ),
    recordTodo: new RecordTodoUsecase(sink, todoSnapshots, ids, clock, CLAUDE_RUNTIME_SOURCE),
    markToolStart: new MarkToolStartUsecase(toolTiming, clock),
};

const session: SessionHook = {
    ensureSession: new EnsureSessionUsecase(bindings, sink, ids, clock),
    endSession: new EndSessionUsecase(sink, ids, clock),
    clearSession: new ClearSessionUsecase(bindings, sink, ids, clock),
};

const turn: TurnHook = {
    openTurn: new OpenTurnUsecase(bindings, clock),
    closeTurn: new CloseTurnUsecase(bindings, sink, ids, clock, CLAUDE_RUNTIME_SOURCE),
};

const binding: BindingHook = {
    readBinding: new ReadBindingUsecase(bindings),
    releaseBinding: new ReleaseBindingUsecase(bindings),
};

const recipe: RecipeHook = {
    getRecipe: new GetRecipeUsecase(new HttpRecipeFetchAdapter(transport.baseUrl, headers)),
    requestScan: new RequestRecipeScanUsecase(recipeJobs),
    reportOutcome: new ReportRecipeOutcomeUsecase(new HttpRecipeOutcomeReportAdapter(transport.baseUrl, headers)),
    searchRecipes: new SearchRecipesUsecase(new HttpRecipeSearchAdapter(transport.baseUrl, headers)),
};

const recipeOutcomeMark: RecipeOutcomeMarkHook = {
    markOpened: new MarkRecipeOpenedUsecase(new FileRecipePendingMarkAdapter(), clock),
    clearMark: new ClearRecipeMarkUsecase(new FileRecipePendingMarkAdapter()),
    readPendingMark: new ReadPendingRecipeMarkUsecase(new FileRecipePendingMarkAdapter(), clock),
};

const logger: HookLogger = createHookLogger({
    logFile: path.join(projectDir, ".claude", "hooks.log"),
    verbose: isVerboseLogging(),
});

/** 훅 프로세스 하나가 쓰는 유스케이스 묶음과 로거와 워크스페이스다. */
export const claudeRuntime = {
    runtimeSource: CLAUDE_RUNTIME_SOURCE,
    projectDir,
    logger,
    ingest,
    session,
    turn,
    binding,
    recipe,
    recipeOutcomeMark,
    todoSnapshots,
} as const;

/** 훅 본문이며 여기서 던진 오류는 기록만 하고 Claude Code를 막지 않는다. */
export interface HookScript<T> {
    readonly parse: (raw: JsonObject) => ReaderResult<T>;
    readonly handler: (payload: T) => Promise<void>;
}

/** 훅 스크립트의 진입점이며 어떤 실패에도 exit 0으로 끝난다. */
export async function runHook<T>(name: string, script: HookScript<T>): Promise<void> {
    let raw: JsonObject;
    try {
        raw = await readStdinJson();
    } catch (error) {
        logger.log(name, "stdin_read_error", {error: messageOf(error)});
        return;
    }

    logger.logPayload(name, raw);

    const parsed = script.parse(raw);
    if (!parsed.ok) {
        logger.log(name, "skipped", {reason: parsed.reason});
        return;
    }

    try {
        await ensureDaemonRunning();
        await script.handler(parsed.value);
    } catch (error) {
        logger.log(name, "handler_error", {
            error: messageOf(error),
            ...(error instanceof Error && error.stack !== undefined ? {stack: error.stack} : {}),
        });
    }
}

/** 세션을 새 태스크에 연결하거나 기존 바인딩을 복원할 때 훅이 얹는 문맥이다. */
export interface EnsureSessionOptions {
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly taskKind?: TaskKind;
    readonly resume?: boolean;
    readonly transcriptPath?: string | undefined;
}

/** 바인딩이 없을 때만 트랜스크립트를 훑어 직전 런타임 세션 ID를 찾는다. */
async function resolveResumedFrom(
    runtimeSessionId: string,
    transcriptPath: string | undefined,
): Promise<string | undefined> {
    if (!transcriptPath) return undefined;
    const key = bindingKey(CLAUDE_RUNTIME_SOURCE, runtimeSessionId);
    if (bindings.read()[key]) return undefined;
    return findResumedSessionId(transcriptPath, runtimeSessionId);
}

/** 환경변수 강제값을 얹어 런타임 세션을 확보한다. */
export async function ensureClaudeSession(
    runtimeSessionId: string,
    title?: string,
    options: EnsureSessionOptions = {},
): Promise<EnsuredSession> {
    const explicitTitle = transport.taskTitleOverride ?? title;
    const resumedFrom = await resolveResumedFrom(runtimeSessionId, options.transcriptPath);
    return onSessionStart(session, {
        runtimeSource: CLAUDE_RUNTIME_SOURCE,
        runtimeSessionId,
        title: explicitTitle ?? defaultTaskTitle(projectDir),
        titled: explicitTitle !== undefined,
        workspacePath: projectDir,
        runtimePid: process.ppid,
        ...(transport.taskIdOverride !== undefined ? {taskId: transport.taskIdOverride} : {}),
        ...(transport.taskOriginOverride !== undefined ? {origin: transport.taskOriginOverride} : {}),
        ...(options.parentTaskId !== undefined ? {parentTaskId: options.parentTaskId} : {}),
        ...(options.parentSessionId !== undefined ? {parentSessionId: options.parentSessionId} : {}),
        ...(options.taskKind !== undefined ? {taskKind: options.taskKind} : {}),
        ...(options.resume === false ? {resume: false} : {}),
        ...(resumedFrom !== undefined ? {resumedFrom} : {}),
    });
}

/** /clear는 새 session_id와 빈 트랜스크립트로 오므로 상속 없이 독립된 새 태스크를 연다. */
export function clearClaudeSession(runtimeSessionId: string): Promise<EnsuredSession> {
    return onSessionClear(session, {
        runtimeSource: CLAUDE_RUNTIME_SOURCE,
        runtimeSessionId,
        title: defaultTaskTitle(projectDir),
        titled: false,
        workspacePath: projectDir,
        runtimePid: process.ppid,
    });
}

/** 서브에이전트에는 부모 session_id만 오므로 agent_id로 판 가상 세션을 자식 태스크에 붙인다. */
export async function ensureSubagentSession(
    parentSessionId: string,
    agentId: string,
    agentType?: string,
    parent?: EnsuredSession,
    transcriptPath?: string,
): Promise<EnsuredSession> {
    const parentIds = parent ?? await ensureClaudeSession(parentSessionId, undefined, {transcriptPath});
    return ensureBackgroundSession(
        parentIds,
        subagentSessionId(agentId),
        subagentTitle(agentId, agentType),
    );
}

/** 백그라운드 위임의 자식 런타임 세션을 부모 태스크에 연결한다. */
export function ensureBackgroundSession(
    parent: EnsuredSession,
    childRuntimeSessionId: string,
    childTitle: string,
): Promise<EnsuredSession> {
    return ensureClaudeSession(childRuntimeSessionId, childTitle, {
        parentTaskId: parent.taskId,
        parentSessionId: parent.sessionId,
        taskKind: "background",
    });
}

/** 훅 이벤트가 붙을 세션을 메인과 서브에이전트 양쪽에서 해석한다. */
export function resolveEventSession(
    sessionId: string,
    agentId?: string,
    agentType?: string,
    transcriptPath?: string,
): Promise<EnsuredSession> {
    if (agentId !== undefined) {
        return ensureSubagentSession(sessionId, agentId, agentType, undefined, transcriptPath);
    }
    return ensureClaudeSession(sessionId, undefined, {transcriptPath});
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
