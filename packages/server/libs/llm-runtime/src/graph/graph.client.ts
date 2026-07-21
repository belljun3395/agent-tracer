import { AGENT } from "@monitor/kernel";
import { context, propagation } from "@opentelemetry/api";
import {
    AGENT_ERROR_SUBTYPE,
    AgentExecutionFailure,
} from "../model/agent.error.js";
import { estimateCostUsd } from "../pricing/pricing.js";
import type { AgentRunnerPort, OutputSchema, StructuredAgentResult } from "../runner/llm.runner.js";
import type { AgentGraphResponse } from "./graph.protocol.js";
import {
    COMPLETION_INBOX_STATUS,
    type CompletionInbox,
    type CompletionInboxEntry,
} from "./durable.completion.inbox.js";

const OUTER_TIMEOUT_BUFFER_MS = 30_000;
const START_TIMEOUT_MS = 30_000;
const CANCEL_TIMEOUT_MS = 5_000;
const COMPLETION_POLL_MS = 100;

const ROUTE_BY_AGENT_ID: Readonly<Record<string, string>> = Object.fromEntries(
    Object.values(AGENT).map((agent) => [agent.id, agent.route]),
);

/** 시작 요청은 접수만 받고 끊기고 결과는 완료 창구로 돌아오므로, 실행이 HTTP 연결 수명에 매이지 않는다. */
export class AgentGraphClient implements AgentRunnerPort {
    constructor(
        private readonly baseUrl: string,
        private readonly completionInbox: CompletionInbox,
    ) {}

    requiresLocalApiKey(): boolean {
        return true;
    }

    async runStructured<T>(
        agentId: string,
        input: Record<string, unknown>,
        schema: OutputSchema<T>,
        opts: { deadlineMs: number; abortSignal?: AbortSignal },
    ): Promise<StructuredAgentResult<T>> {
        const runId = cancellationRunId(input);
        if (runId === null) throw new AgentExecutionFailure(agentId, "AGENT_FAILED", "agent-graph run requires an id");
        const runKey = `${agentId}:${runId}`;
        const deadlineMs = opts.deadlineMs + OUTER_TIMEOUT_BUFFER_MS;
        const opened = await this.completionInbox.open(runKey, deadlineMs);

        try {
            if (opened.grant !== null) {
                await this.start(agentId, { ...input, completionCallback: opened.grant });
            }
            const response = await this.waitForCompletion(runKey, opened.entry, deadlineMs, opts.abortSignal);
            return parseStructured(agentId, response as unknown as AgentGraphResponse, schema);
        } catch (error) {
            // 기다림을 멈춘 뒤에도 백엔드는 계속 돌고 있으므로 고아가 된 실행을 끊는다.
            await this.completionInbox.close(runKey, "canceled");
            await this.cancelRun(runId);
            throw error;
        }
    }

    private async waitForCompletion(
        runKey: string,
        initial: CompletionInboxEntry,
        deadlineMs: number,
        abortSignal?: AbortSignal,
    ): Promise<Record<string, unknown>> {
        const deadlineAt = Date.now() + deadlineMs;
        let entry: CompletionInboxEntry | null = initial;
        while (entry !== null) {
            if (entry.status === COMPLETION_INBOX_STATUS.completed && entry.response !== null) return entry.response;
            if (entry.status !== COMPLETION_INBOX_STATUS.pending) {
                throw new AgentExecutionFailure("agent-graph", "AGENT_FAILED", `agent-graph completion ${entry.status}`);
            }
            if (abortSignal?.aborted === true) {
                throw new AgentExecutionFailure("agent-graph", "AGENT_FAILED", "agent-graph run cancelled");
            }
            if (Date.now() >= deadlineAt) {
                await this.completionInbox.close(runKey, "expired");
                throw new AgentExecutionFailure("agent-graph", "AGENT_FAILED", "agent-graph completion timeout");
            }
            await delay(COMPLETION_POLL_MS);
            entry = await this.completionInbox.find(runKey);
        }
        throw new AgentExecutionFailure("agent-graph", "AGENT_FAILED", "agent-graph completion inbox missing");
    }

    private async start(agentId: string, input: Record<string, unknown>): Promise<void> {
        const path = ROUTE_BY_AGENT_ID[agentId];
        if (path === undefined) throw new Error(`unknown agent route: ${agentId}`);

        const headers: Record<string, string> = { "content-type": "application/json" };
        propagation.inject(context.active(), headers);

        let response: Response;
        try {
            response = await fetch(new URL(path, this.baseUrl), {
                method: "POST",
                headers,
                body: JSON.stringify(input),
                signal: AbortSignal.timeout(START_TIMEOUT_MS),
            });
        } catch (error) {
            throw new AgentExecutionFailure(
                agentId,
                "AGENT_FAILED",
                `agent-graph start failed: ${messageOf(error)}`,
            );
        }

        if (!response.ok) {
            const text = await response.text().catch(() => "");
            const subtype = response.status >= 400 && response.status < 500
                ? AGENT_ERROR_SUBTYPE.invalidRequest
                : null;
            throw new AgentExecutionFailure(
                agentId,
                "AGENT_FAILED",
                `agent-graph start HTTP ${response.status}: ${text.slice(0, 500)}`,
                { errorSubtype: subtype },
            );
        }
    }

    private async cancelRun(runId: string): Promise<void> {
        try {
            await fetch(new URL(`/agents/runs/${encodeURIComponent(runId)}/cancel`, this.baseUrl), {
                method: "POST",
                signal: AbortSignal.timeout(CANCEL_TIMEOUT_MS),
            });
        } catch {
            return;
        }
    }
}

function parseStructured<T>(
    agentId: string,
    payload: AgentGraphResponse,
    schema: OutputSchema<T>,
): StructuredAgentResult<T> {
    const actualModel = payload.actualModel ?? payload.modelUsed;
    const detail = {
        usage: payload.usage,
        steps: payload.steps,
        actualModel,
        providerRequestId: payload.providerRequestId,
        durationMs: payload.durationMs,
    };

    if (payload.error !== null) {
        throw new AgentExecutionFailure(agentId, "AGENT_FAILED", `agent-graph error: ${payload.error.summary}`, {
            ...detail,
            errorSubtype: payload.error.subtype,
        });
    }
    if (payload.data === null) {
        throw new AgentExecutionFailure(agentId, "OUTPUT_NOT_JSON", "agent-graph returned no data", detail);
    }

    const parsed = schema.safeParse(payload.data);
    if (!parsed.success) {
        throw new AgentExecutionFailure(
            agentId,
            "OUTPUT_SCHEMA_INVALID",
            `agent output failed schema validation: ${parsed.error.message}`,
            detail,
        );
    }

    return {
        data: parsed.data,
        modelUsed: actualModel,
        durationMs: payload.durationMs,
        costUsd: estimateCostUsd(actualModel, payload.usage),
        numTurns: payload.numTurns,
        usage: payload.usage,
        steps: payload.steps,
        providerRequestId: payload.providerRequestId,
    };
}

function cancellationRunId(body: Record<string, unknown>): string | null {
    for (const field of ["idempotencyKey", "jobId"] as const) {
        const value = body[field];
        if (typeof value === "string" && value.trim().length > 0) return value;
    }
    return null;
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
