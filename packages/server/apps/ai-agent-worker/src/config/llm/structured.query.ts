import type { AiJobStepPayload } from "@monitor/kernel";
import { AgentExecutionFailure } from "~ai-agent-worker/support/llm/agent.error.js";
import type { AgentQueryUsage } from "~ai-agent-worker/support/llm/agent.usage.js";
import { parseJsonStrict } from "~ai-agent-worker/support/parse.json.js";
import type { AgentQueryRequest, IQueryRunner, OutputSchema } from "./llm.runner.js";

export interface StructuredQueryResult<T> {
    readonly data: T;
    readonly rawOutput: string;
    readonly modelUsed: string;
    readonly durationMs: number;
    readonly costUsd: number | null;
    readonly numTurns: number | null;
    readonly usage: AgentQueryUsage | null;
    readonly steps: readonly AiJobStepPayload[];
    readonly providerRequestId: string | null;
}

/** 실행과 오류 정규화와 JSON 파싱과 스키마 검증까지의 공통 경로를 한 곳에 모은다. */
export async function runStructuredQuery<T, ProviderOptions = undefined>(
    runner: IQueryRunner<ProviderOptions>,
    request: AgentQueryRequest<ProviderOptions>,
    schema: OutputSchema<T>,
): Promise<StructuredQueryResult<T>> {
    const result = await runner.run(request);
    const detail = {
        errorSubtype: result.errorSubtype,
        usage: result.usage,
        steps: result.steps,
        actualModel: result.actualModel,
        providerRequestId: result.providerRequestId,
        retryAfterMs: result.retryAfterMs ?? null,
        durationMs: result.durationMs,
    };

    if (result.errorSummary !== null || (!result.rawOutput && result.structuredOutput === null)) {
        throw new AgentExecutionFailure(
            request.label,
            "AGENT_FAILED",
            `Agent backend returned an error${result.errorSummary ? `: ${result.errorSummary}` : ""}`,
            detail,
        );
    }

    const json = result.structuredOutput ?? parseJsonStrict(result.rawOutput);
    if (json === null || json === undefined) {
        throw new AgentExecutionFailure(request.label, "OUTPUT_NOT_JSON", "Agent output was not parseable JSON", {
            ...detail,
            errorSubtype: null,
            retryAfterMs: null,
        });
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
        throw new AgentExecutionFailure(
            request.label,
            "OUTPUT_SCHEMA_INVALID",
            `Agent output failed schema validation: ${parsed.error.message}`,
            { ...detail, errorSubtype: null, retryAfterMs: null },
        );
    }

    return {
        data: parsed.data,
        rawOutput: result.rawOutput,
        // 공급자가 실제로 응답한 모델을 우선하고 응답이 없던 경우에만 요청 모델로 대체한다.
        modelUsed: result.actualModel ?? request.model,
        durationMs: result.durationMs,
        costUsd: result.costUsd,
        numTurns: result.numTurns,
        usage: result.usage,
        steps: result.steps,
        providerRequestId: result.providerRequestId,
    };
}
