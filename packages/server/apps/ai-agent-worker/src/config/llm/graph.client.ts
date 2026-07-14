import { AGENT } from "@monitor/kernel";
import { context, propagation } from "@opentelemetry/api";
import {
    AGENT_ERROR_SUBTYPE,
    AgentExecutionFailure,
} from "~ai-agent-worker/support/llm/agent.error.js";
import { estimateCostUsd } from "~ai-agent-worker/support/llm/pricing.js";
import type { AgentRunnerPort, OutputSchema, StructuredAgentResult } from "./llm.runner.js";
import type { AgentGraphResponse } from "./graph.protocol.js";

const OUTER_TIMEOUT_BUFFER_MS = 30_000;

const ROUTE_BY_AGENT_ID: Readonly<Record<string, string>> = Object.fromEntries(
    Object.values(AGENT).map((agent) => [agent.id, agent.route]),
);

/** LangGraph 실행 백엔드를 HTTP로 부르는 에이전트 실행기다. */
export class AgentGraphClient implements AgentRunnerPort {
    constructor(private readonly baseUrl: string) {}

    requiresLocalApiKey(): boolean {
        return true;
    }

    async runStructured<T>(
        agentId: string,
        input: Record<string, unknown>,
        schema: OutputSchema<T>,
        opts: { deadlineMs: number; abortSignal?: AbortSignal },
    ): Promise<StructuredAgentResult<T>> {
        const path = ROUTE_BY_AGENT_ID[agentId];
        if (path === undefined) throw new Error(`unknown agent route: ${agentId}`);

        const controller = new AbortController();
        const runId = cancellationRunId(input);
        const timer = setTimeout(
            () => controller.abort(new Error("agent-graph request timeout")),
            opts.deadlineMs + OUTER_TIMEOUT_BUFFER_MS,
        );
        const onParentAbort = (): void => controller.abort();
        if (opts.abortSignal) {
            if (opts.abortSignal.aborted) controller.abort();
            else opts.abortSignal.addEventListener("abort", onParentAbort, { once: true });
        }

        const headers: Record<string, string> = { "content-type": "application/json" };
        propagation.inject(context.active(), headers);

        let response: Response;
        try {
            response = await fetch(new URL(path, this.baseUrl), {
                method: "POST",
                headers,
                body: JSON.stringify(input),
                signal: controller.signal,
            });
        } catch (error) {
            if (controller.signal.aborted && runId !== null) await this.cancelRun(runId);
            throw new AgentExecutionFailure(
                agentId,
                "AGENT_FAILED",
                `agent-graph request failed: ${messageOf(error)}`,
            );
        } finally {
            clearTimeout(timer);
            if (opts.abortSignal) opts.abortSignal.removeEventListener("abort", onParentAbort);
        }

        if (!response.ok) {
            const text = await response.text().catch(() => "");
            const subtype = response.status >= 400 && response.status < 500
                ? AGENT_ERROR_SUBTYPE.invalidRequest
                : null;
            throw new AgentExecutionFailure(
                agentId,
                "AGENT_FAILED",
                `agent-graph HTTP ${response.status}: ${text.slice(0, 500)}`,
                { errorSubtype: subtype },
            );
        }

        const payload = (await response.json()) as AgentGraphResponse;
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

    private async cancelRun(runId: string): Promise<void> {
        try {
            await fetch(new URL(`/agents/runs/${encodeURIComponent(runId)}/cancel`, this.baseUrl), {
                method: "POST",
                signal: AbortSignal.timeout(5_000),
            });
        } catch {
            return;
        }
    }
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
