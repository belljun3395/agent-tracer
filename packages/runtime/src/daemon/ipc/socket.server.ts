import type * as net from "node:net";
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
import {onTurnStop, type GuardrailHook} from "~runtime/domain/guardrail/inbound/guardrail.hook.js";
import {formatGuardrailLog} from "~runtime/domain/guardrail/model/enforce.model.js";
import {isEnforceableRule, type GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";
import {onHintsRequested, type HintHook} from "~runtime/domain/hint/inbound/hint.hook.js";
import type {RecentEventRing} from "~runtime/domain/ingest/model/recent.event.model.js";

/** 데몬이 소켓 요청을 처리하는 데 필요한 도메인 진입점과 상태다. */
export interface DaemonSocketContext {
    readonly version: string;
    readonly ring: RecentEventRing;
    readonly interventions: InterventionLog;
    readonly guardrail: GuardrailHook;
    readonly hint: HintHook;
    readonly readRules: () => readonly GuardrailRule[];
    readonly readDelivery: () => DaemonDeliveryResponse;
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
        let buffer = "";
        socket.on("data", (chunk) => {
            buffer += chunk.toString("utf8");
            const index = buffer.indexOf("\n");
            if (index === -1) return;
            const line = buffer.slice(0, index).trim();
            if (line) handleMessage(socket, line, context);
        });
        socket.on("close", context.onConnectionClosed);
        socket.on("error", () => undefined);
    };
}

function handleMessage(socket: net.Socket, line: string, context: DaemonSocketContext): void {
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
                process.stderr.write(`[agent-tracer-daemon] shutdown requested via socket (${reason})\n`);
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
        }
    } catch {
        context.recordSwallowedError();
        send(socket, {hints: []} satisfies DaemonHintsResponse);
    }
}

function send(socket: net.Socket, response: DaemonResponse): void {
    socket.end(`${JSON.stringify(response)}\n`);
}
