import { AGENT } from "@monitor/kernel";
import { context, propagation } from "@opentelemetry/api";
import { AGENT_ERROR_SUBTYPE, AgentExecutionFailure } from "../model/agent.error.js";
import type { AgentQueryUsage } from "../model/agent.usage.js";
import { estimateCostUsd } from "../pricing/pricing.js";
import type { OutputSchema } from "../runner/llm.runner.js";

const ROUTE_BY_AGENT_ID: Readonly<Record<string, string>> = Object.fromEntries(
    Object.values(AGENT).map((agent) => [agent.id, agent.route]),
);

/** 열린 HTTP 연결에서 토큰 스트림을 소비하고 마지막에 검증된 구조화 결과를 낸다. */
export interface AgentStreamRunResult<T> {
    readonly data: T;
    readonly modelUsed: string;
    readonly usage: AgentQueryUsage | null;
    readonly numTurns: number | null;
    readonly costUsd: number | null;
    readonly providerRequestId: string | null;
    readonly durationMs: number;
}

/** delta 토큰을 받는 콜백이며, Promise를 돌려주면 클라이언트가 역압력으로 소비를 늦춘다. */
export type AgentDeltaListener = (text: string) => void | Promise<void>;

/** 실행을 열린 연결로 스트리밍하며 delta는 콜백으로, 최종 결과는 반환으로 내주는 실행기다. */
export interface StreamingAgentRunnerPort {
    requiresLocalApiKey(): boolean;
    streamStructured<T>(
        agentId: string,
        input: Record<string, unknown>,
        schema: OutputSchema<T>,
        opts: { deadlineMs: number; abortSignal?: AbortSignal },
        onDelta: AgentDeltaListener,
    ): Promise<AgentStreamRunResult<T>>;
}

/** 실행을 요청한 HTTP 연결이 스트림 수명이 되며, 그 연결이 끊기면 백엔드 실행도 함께 끊긴다. */
export class AgentGraphStreamClient implements StreamingAgentRunnerPort {
    constructor(private readonly baseUrl: string) {}

    requiresLocalApiKey(): boolean {
        return true;
    }

    async streamStructured<T>(
        agentId: string,
        input: Record<string, unknown>,
        schema: OutputSchema<T>,
        opts: { deadlineMs: number; abortSignal?: AbortSignal },
        onDelta: AgentDeltaListener,
    ): Promise<AgentStreamRunResult<T>> {
        const route = ROUTE_BY_AGENT_ID[agentId];
        if (route === undefined) throw new AgentExecutionFailure(agentId, "AGENT_FAILED", `unknown agent route: ${agentId}`);

        // deadline은 스트림 전체 상한이며, 초과하거나 호출자가 취소하면 연결이 끊겨 백엔드 실행까지 멈춘다.
        const signals: AbortSignal[] = [AbortSignal.timeout(opts.deadlineMs)];
        if (opts.abortSignal !== undefined) signals.push(opts.abortSignal);
        const signal = AbortSignal.any(signals);
        try {
            const response = await this.open(agentId, route, input, signal);
            return await this.consume(agentId, response, schema, onDelta);
        } catch (error) {
            if (signal.aborted) throw new AgentExecutionFailure(agentId, "AGENT_FAILED", "agent-graph stream cancelled");
            throw error;
        }
    }

    private async open(
        agentId: string,
        route: string,
        input: Record<string, unknown>,
        signal: AbortSignal,
    ): Promise<Response> {
        const headers: Record<string, string> = { "content-type": "application/json" };
        propagation.inject(context.active(), headers);

        let response: Response;
        try {
            response = await fetch(new URL(`${route}/stream`, this.baseUrl), {
                method: "POST",
                headers,
                body: JSON.stringify(input),
                signal,
            });
        } catch (error) {
            throw new AgentExecutionFailure(agentId, "AGENT_FAILED", `agent-graph stream start failed: ${messageOf(error)}`);
        }
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            const subtype = response.status >= 400 && response.status < 500 ? AGENT_ERROR_SUBTYPE.invalidRequest : null;
            throw new AgentExecutionFailure(
                agentId,
                "AGENT_FAILED",
                `agent-graph stream HTTP ${response.status}: ${text.slice(0, 500)}`,
                { errorSubtype: subtype },
            );
        }
        if (response.body === null) throw new AgentExecutionFailure(agentId, "AGENT_FAILED", "agent-graph stream returned no body");
        return response;
    }

    private async consume<T>(
        agentId: string,
        response: Response,
        schema: OutputSchema<T>,
        onDelta: AgentDeltaListener,
    ): Promise<AgentStreamRunResult<T>> {
        const reader = (response.body as ReadableStream<Uint8Array>).getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let result: AgentStreamRunResult<T> | null = null;
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let newline: number;
            while ((newline = buffer.indexOf("\n")) >= 0) {
                const line = buffer.slice(0, newline);
                buffer = buffer.slice(newline + 1);
                result = (await this.handleLine(agentId, line, schema, onDelta)) ?? result;
            }
        }
        result = (await this.handleLine(agentId, buffer, schema, onDelta)) ?? result;
        if (result === null) throw new AgentExecutionFailure(agentId, "AGENT_FAILED", "agent-graph stream ended without a result");
        return result;
    }

    private async handleLine<T>(
        agentId: string,
        raw: string,
        schema: OutputSchema<T>,
        onDelta: AgentDeltaListener,
    ): Promise<AgentStreamRunResult<T> | null> {
        const line = raw.trim();
        if (line.length === 0) return null;
        const parsed = parseStreamLine(agentId, line);
        if (parsed.kind === "delta") {
            // 역압력을 존중하도록 delta 소비가 끝날 때까지 다음 줄을 읽지 않는다.
            await onDelta(parsed.text);
            return null;
        }
        if (parsed.kind === "error") {
            throw new AgentExecutionFailure(agentId, "AGENT_FAILED", `agent-graph stream error: ${parsed.summary}`, {
                errorSubtype: parsed.subtype,
            });
        }
        if (parsed.kind === "other") return null;
        const validated = schema.safeParse(parsed.data);
        if (!validated.success) {
            throw new AgentExecutionFailure(
                agentId,
                "OUTPUT_SCHEMA_INVALID",
                `agent output failed schema validation: ${validated.error.message}`,
            );
        }
        return {
            data: validated.data,
            modelUsed: parsed.modelUsed,
            usage: parsed.usage,
            numTurns: parsed.numTurns,
            costUsd: estimateCostUsd(parsed.actualModel ?? parsed.modelUsed, parsed.usage),
            providerRequestId: parsed.providerRequestId,
            durationMs: parsed.durationMs,
        };
    }
}

type StreamLine =
    | { readonly kind: "delta"; readonly text: string }
    | { readonly kind: "error"; readonly subtype: string | null; readonly summary: string }
    | { readonly kind: "other" }
    | {
          readonly kind: "result";
          readonly data: unknown;
          readonly modelUsed: string;
          readonly actualModel: string | null;
          readonly usage: AgentQueryUsage | null;
          readonly numTurns: number | null;
          readonly providerRequestId: string | null;
          readonly durationMs: number;
      };

function parseStreamLine(agentId: string, line: string): StreamLine {
    let record: Record<string, unknown>;
    try {
        const value: unknown = JSON.parse(line);
        if (typeof value !== "object" || value === null) throw new Error("line is not an object");
        record = value as Record<string, unknown>;
    } catch (error) {
        throw new AgentExecutionFailure(agentId, "OUTPUT_NOT_JSON", `agent-graph stream line is not JSON: ${messageOf(error)}`);
    }
    const type = record["type"];
    if (type === "delta") return { kind: "delta", text: typeof record["text"] === "string" ? record["text"] : "" };
    if (type === "error") {
        const data = asRecord(record["data"]);
        return { kind: "error", subtype: asStringOrNull(data["subtype"]), summary: asString(data["summary"]) };
    }
    if (type === "result") {
        return {
            kind: "result",
            data: record["data"] ?? null,
            modelUsed: asString(record["modelUsed"]),
            actualModel: asStringOrNull(record["actualModel"]),
            usage: asUsage(record["usage"]),
            numTurns: asNumberOrNull(record["numTurns"]),
            providerRequestId: asStringOrNull(record["providerRequestId"]),
            durationMs: asNumberOrNull(record["durationMs"]) ?? 0,
        };
    }
    return { kind: "other" };
}

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asUsage(value: unknown): AgentQueryUsage | null {
    return typeof value === "object" && value !== null ? (value as AgentQueryUsage) : null;
}

function asString(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function asStringOrNull(value: unknown): string | null {
    return typeof value === "string" ? value : null;
}

function asNumberOrNull(value: unknown): number | null {
    return typeof value === "number" ? value : null;
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
