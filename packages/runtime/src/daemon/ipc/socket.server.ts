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
    type DaemonRulesResponse,
    type DaemonVersionResponse,
} from "~runtime/daemon/port/daemon.socket.port.js";
import type {
    DaemonRecipeOutcomeResponse,
    DaemonRecipeScanResponse,
    DaemonRecipeSearchResponse,
    DaemonSetTaskTitleResponse,
} from "~runtime/daemon/port/mcp.socket.port.js";
import {onTurnStop, type GuardrailHook} from "~runtime/domain/guardrail/inbound/guardrail.hook.js";
import {formatGuardrailLog} from "~runtime/domain/guardrail/model/enforce.model.js";
import {isEnforceableRule, type GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";
import {onHintsRequested, type HintHook} from "~runtime/domain/hint/inbound/hint.hook.js";
import type {RecentEventRing} from "~runtime/domain/ingest/model/recent.event.model.js";
import {
    onPromptRecipes,
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
    readonly readRules: () => readonly GuardrailRule[];
    readonly readDelivery: () => DaemonDeliveryResponse;
    /** MCP 도구처럼 자기 세션을 모르는 호출자를 위해 가장 최근 활성 태스크를 추정한다. */
    readonly findActiveTaskId: () => string | undefined;
    readonly setTaskTitle: (taskId: string, title: string) => Promise<boolean>;
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
            case "recipe-injected":
                context.interventions.recordRecipeInjected(
                    Date.now(),
                    request.taskId,
                    request.titles,
                    request.injectedBytes,
                );
                send(socket, {ok: true} satisfies DaemonAckResponse);
                return;
            case "rules":
                send(socket, {
                    rules: context.readRules().filter((rule) => isEnforceableRule(rule, request.taskId)),
                } satisfies DaemonRulesResponse);
                return;
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
            case "recipe-search": {
                const {matches} = onPromptRecipes(context.recipe, request.query, request.limit);
                send(socket, {matches} satisfies DaemonRecipeSearchResponse);
                return;
            }
            case "recipe-outcome": {
                const taskId = context.findActiveTaskId();
                if (taskId === undefined) {
                    send(socket, {ok: false, reason: "no_active_task"} satisfies DaemonRecipeOutcomeResponse);
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
                const taskId = context.findActiveTaskId();
                if (taskId === undefined) {
                    send(socket, {queued: false, reason: "no_active_task"} satisfies DaemonRecipeScanResponse);
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
                const taskId = context.findActiveTaskId();
                if (taskId === undefined) {
                    send(socket, {ok: false, reason: "no_active_task"} satisfies DaemonSetTaskTitleResponse);
                    return;
                }
                const ok = await context.setTaskTitle(taskId, request.title);
                send(socket, {ok} satisfies DaemonSetTaskTitleResponse);
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
