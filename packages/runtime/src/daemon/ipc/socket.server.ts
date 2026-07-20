import type * as net from "node:net";
import {daemonLog} from "~runtime/daemon/daemon.log.js";
import {createLineFramer} from "~runtime/daemon/ipc/socket.framing.js";
import type {InterventionLog} from "~runtime/daemon/observation/intervention.log.js";
import {
    parseDaemonRequest,
    type DaemonAckResponse,
    type DaemonDeliveryResponse,
    type DaemonGuardrailResponse,
    type DaemonHintsResponse,
    type DaemonResponse,
    type DaemonPromptContextResponse,
    type DaemonVersionResponse,
} from "~runtime/daemon/port/daemon.socket.port.js";
import type {
    DaemonMemoCreateResponse,
    DaemonMemoSearchResponse,
    DaemonRecipeGetResponse,
    DaemonRecipeOutcomeResponse,
    DaemonRecipeScanResponse,
    DaemonSetTaskTitleResponse,
} from "~runtime/daemon/port/mcp.socket.port.js";
import {onTurnStop, type GuardrailHook} from "~runtime/domain/guardrail/inbound/guardrail.hook.js";
import {formatGuardrailLog} from "~runtime/domain/guardrail/model/enforce.model.js";
import {isEnforceableRule, type GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";
import {onHintsRequested, type HintHook} from "~runtime/domain/hint/inbound/hint.hook.js";
import type {IngestTarget} from "~runtime/domain/ingest/model/event.model.js";
import {recipeInjectedEvent} from "~runtime/domain/ingest/model/recipe.injection.event.model.js";
import type {RecentEventRing} from "~runtime/domain/ingest/model/recent.event.model.js";
import type {RunEventInput} from "~runtime/domain/ingest/model/ingest.event.model.js";
import {
    onMemoCreateRequested,
    onMemoSearchRequested,
    type MemoHook,
} from "~runtime/domain/memo/inbound/memo.hook.js";
import {
    onGetRecipe,
    onRecipeOutcomeReported,
    onRecipeScanRequested,
    type RecipeHook,
} from "~runtime/domain/recipe/inbound/recipe.hook.js";
import {generateUlid} from "~runtime/support/ulid.js";

const MCP_RECIPE_SCAN_PROMPT = "/recipe";

/** 데몬이 소켓 요청을 처리하는 데 필요한 도메인 진입점과 상태다. */
export interface DaemonSocketContext {
    readonly version: string;
    readonly ring: RecentEventRing;
    readonly interventions: InterventionLog;
    readonly guardrail: GuardrailHook;
    readonly hint: HintHook;
    readonly recipe: RecipeHook;
    readonly memo: MemoHook;
    readonly readRules: () => readonly GuardrailRule[];
    readonly readDelivery: () => DaemonDeliveryResponse;
    /** MCP 도구가 실은 자기 세션 식별자로 바인딩을 지목하며 못 찾으면 undefined이고 추정하지 않는다. */
    readonly findTargetBySession: (sessionId: string) => IngestTarget | undefined;
    readonly setTaskTitle: (taskId: string, title: string) => Promise<boolean>;
    readonly appendIngestEvents: (events: readonly RunEventInput[]) => Promise<void>;
    readonly refreshHistory: () => void;
    readonly onHookVersion: (version: string) => void;
    readonly onActivity: () => void;
    readonly onConnectionOpened: () => void;
    readonly onConnectionClosed: () => void;
    readonly recordSwallowedError: () => void;
    readonly shutdown: (reason: string) => void;
}

/** 소켓 연결의 한 줄 요청을 프로토콜 응답으로 바꾼다. */
export function createDaemonConnectionHandler(context: DaemonSocketContext): (socket: net.Socket) => void {
    return (socket) => {
        context.onConnectionOpened();
        context.onActivity();
        const frame = createLineFramer();
        socket.on("data", (chunk) => {
            const line = frame(chunk);
            if (line) void handleMessage(socket, line, context);
        });
        socket.on("close", context.onConnectionClosed);
        socket.on("error", () => undefined);
    };
}

async function handleMessage(socket: net.Socket, line: string, context: DaemonSocketContext): Promise<void> {
    try {
        const request = parseDaemonRequest(JSON.parse(line) as unknown);
        if (request === null) {
            send(socket, {hints: []} satisfies DaemonHintsResponse);
            return;
        }

        switch (request.type) {
            case "version":
                if (request.hookVersion !== undefined) context.onHookVersion(request.hookVersion);
                send(socket, {version: context.version, pid: process.pid} satisfies DaemonVersionResponse);
                return;
            case "shutdown": {
                const reason = request.reason ?? "requested";
                send(socket, {ok: true} satisfies DaemonAckResponse);
                daemonLog(`shutdown requested via socket (${reason})`);
                context.shutdown(`socket-shutdown: ${reason}`);
                return;
            }
            case "hints": {
                const hints = onHintsRequested(context.hint, context.ring.recent(request.taskId), request.request);
                const body = JSON.stringify({hints} satisfies DaemonHintsResponse);
                context.interventions.recordHintsInjected(
                    Date.now(),
                    request.taskId,
                    request.request.trigger,
                    hints,
                    Buffer.byteLength(body, "utf8"),
                );
                socket.end(`${body}\n`);
                return;
            }
            case "prompt-context": {
                const hints = onHintsRequested(context.hint, context.ring.recent(request.taskId), request.request);
                const rules = context.readRules().filter((rule) => isEnforceableRule(rule, request.taskId));
                const body = JSON.stringify({rules, hints} satisfies DaemonPromptContextResponse);
                context.interventions.recordHintsInjected(
                    Date.now(),
                    request.taskId,
                    request.request.trigger,
                    hints,
                    Buffer.byteLength(body, "utf8"),
                );
                socket.end(`${body}\n`);
                return;
            }
            case "delivery":
                send(socket, context.readDelivery() satisfies DaemonDeliveryResponse);
                return;
            case "guardrail": {
                context.refreshHistory();
                const {verdicts, blocking} = onTurnStop(
                    context.guardrail,
                    context.ring.recent(request.taskId),
                    context.readRules(),
                    request.taskId,
                    {
                        ...(request.sessionId !== undefined ? {sessionId: request.sessionId} : {}),
                        ...(request.candidateAssistantText !== undefined
                            ? {candidateAssistantText: request.candidateAssistantText}
                            : {}),
                    },
                );
                context.interventions.recordVerdicts(Date.now(), request.taskId, verdicts, blocking);
                if (verdicts.length > 0 && process.env.AGENT_TRACER_GUARDRAIL_LOG !== "0") {
                    process.stderr.write(`${formatGuardrailLog(request.taskId, verdicts)}\n`);
                }
                send(socket, {verdicts: blocking} satisfies DaemonGuardrailResponse);
                return;
            }
            case "recipe-get": {
                const body = onGetRecipe(context.recipe, request.recipeId);
                if (body !== null) {
                    const target = request.sessionId === undefined
                        ? undefined
                        : context.findTargetBySession(request.sessionId);
                    if (target !== undefined) {
                        context.interventions.recordRecipeInjected(
                            Date.now(),
                            target.taskId,
                            [recipeTitleFromBody(body)],
                            Buffer.byteLength(body, "utf8"),
                        );
                        await context.appendIngestEvents([
                            recipeInjectedEvent(target, {
                                recipeId: request.recipeId,
                                applicationId: generateUlid(),
                                injectedVia: "pull",
                            }),
                        ]);
                    }
                }
                send(socket, {body} satisfies DaemonRecipeGetResponse);
                return;
            }
            case "recipe-outcome": {
                const taskId = context.findTargetBySession(request.sessionId)?.taskId;
                if (taskId === undefined) {
                    send(socket, {ok: false, reason: "unknown_session"} satisfies DaemonRecipeOutcomeResponse);
                    return;
                }
                const ok = await onRecipeOutcomeReported(context.recipe, {
                    recipeId: request.recipeId,
                    taskId,
                    outcome: request.outcome,
                    ...(request.note !== undefined ? {note: request.note} : {}),
                });
                send(socket, {ok} satisfies DaemonRecipeOutcomeResponse);
                return;
            }
            case "recipe-scan-request": {
                const taskId = context.findTargetBySession(request.sessionId)?.taskId;
                if (taskId === undefined) {
                    send(socket, {queued: false, reason: "unknown_session"} satisfies DaemonRecipeScanResponse);
                    return;
                }
                // 기존 /recipe 슬래시 명령 경로를 그대로 타도록 같은 명령 접두사를 합성한다.
                const queued = await onRecipeScanRequested(context.recipe, {
                    taskId,
                    eventId: generateUlid(),
                    prompt: MCP_RECIPE_SCAN_PROMPT,
                });
                send(socket, {queued} satisfies DaemonRecipeScanResponse);
                return;
            }
            case "set-task-title": {
                const taskId = context.findTargetBySession(request.sessionId)?.taskId;
                if (taskId === undefined) {
                    send(socket, {ok: false, reason: "unknown_session"} satisfies DaemonSetTaskTitleResponse);
                    return;
                }
                const ok = await context.setTaskTitle(taskId, request.title);
                send(socket, {ok} satisfies DaemonSetTaskTitleResponse);
                return;
            }
            case "memo-create": {
                const taskId = context.findTargetBySession(request.sessionId)?.taskId;
                if (taskId === undefined) {
                    send(socket, {ok: false, reason: "unknown_session"} satisfies DaemonMemoCreateResponse);
                    return;
                }
                const ok = await onMemoCreateRequested(context.memo, {
                    taskId,
                    body: request.body,
                    ...(request.eventId !== undefined ? {eventId: request.eventId} : {}),
                });
                send(socket, {ok} satisfies DaemonMemoCreateResponse);
                return;
            }
            case "memo-search": {
                const taskId = context.findTargetBySession(request.sessionId)?.taskId;
                if (taskId === undefined) {
                    send(socket, {items: [], reason: "unknown_session"} satisfies DaemonMemoSearchResponse);
                    return;
                }
                const items = await onMemoSearchRequested(context.memo, {
                    taskId,
                    ...(request.query !== undefined ? {query: request.query} : {}),
                    ...(request.limit !== undefined ? {limit: request.limit} : {}),
                });
                send(socket, {items} satisfies DaemonMemoSearchResponse);
                return;
            }
        }
    } catch {
        context.recordSwallowedError();
        send(socket, {hints: []} satisfies DaemonHintsResponse);
    }
}

function send(socket: net.Socket, response: DaemonResponse): void {
    socket.end(`${JSON.stringify(response)}\n`);
}

/** 개입 로그의 상세 표시용으로 레시피 본문 첫 줄(`# 제목`)에서 제목만 뽑는다. */
function recipeTitleFromBody(body: string): string {
    const firstLine = body.split("\n", 1)[0] ?? "";
    return firstLine.replace(/^#\s*/, "").trim() || firstLine;
}
