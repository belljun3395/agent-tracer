import type { AiJobStepPayload } from "@monitor/kernel";
import type { AgentQueryUsage } from "./agent.usage.js";

// 여러 실행기가 같은 문자열을 참조하도록 공급자 원시 값을 이 어휘로 정규화한다.
export const AGENT_ERROR_SUBTYPE = {
    maxTurnsExceeded: "max_turns_exceeded",
    // 파이썬 백엔드의 max_tool_calls_exceeded와 같은 문자열을 써 두 백엔드가 같은 서브타입으로 보고한다.
    maxToolCallsExceeded: "max_tool_calls_exceeded",
    budgetExceeded: "budget_exceeded",
    outputSchemaInvalid: "output_schema_invalid",
    executionError: "agent_execution_error",
    deadlineExceeded: "deadline_exceeded",
    cancelled: "cancelled",
    processError: "process_error",
    invalidRequest: "invalid_request_error",
} as const;

export type AgentErrorSubtype = (typeof AGENT_ERROR_SUBTYPE)[keyof typeof AGENT_ERROR_SUBTYPE];

export type AgentJobErrorCode = "AGENT_FAILED" | "OUTPUT_NOT_JSON" | "OUTPUT_SCHEMA_INVALID";

/** 실패한 시도가 이미 청구한 비용과 궤적과 실제 모델을 그대로 위로 흘려보낸다. */
export interface AgentFailureDetail {
    readonly errorSubtype: string | null;
    readonly usage: AgentQueryUsage | null;
    readonly steps: readonly AiJobStepPayload[];
    readonly actualModel: string | null;
    readonly providerRequestId: string | null;
    readonly retryAfterMs: number | null;
    readonly durationMs: number | null;
}

export class AgentExecutionFailure extends Error {
    readonly errorSubtype: string | null;
    readonly usage: AgentQueryUsage | null;
    readonly steps: readonly AiJobStepPayload[];
    readonly actualModel: string | null;
    readonly providerRequestId: string | null;
    readonly retryAfterMs: number | null;
    readonly durationMs: number | null;

    constructor(
        readonly label: string,
        readonly code: AgentJobErrorCode,
        message: string,
        detail: Partial<AgentFailureDetail> = {},
    ) {
        super(message);
        this.name = "AgentExecutionFailure";
        this.errorSubtype = detail.errorSubtype ?? null;
        this.usage = detail.usage ?? null;
        this.steps = detail.steps ?? [];
        this.actualModel = detail.actualModel ?? null;
        this.providerRequestId = detail.providerRequestId ?? null;
        this.retryAfterMs = detail.retryAfterMs ?? null;
        this.durationMs = detail.durationMs ?? null;
    }
}

const NON_RETRYABLE_SUBTYPES: ReadonlySet<string> = new Set([
    "authentication_error",
    "permission_error",
    "not_found_error",
    "unprocessable_entity_error",
    "max_tokens",
    "content_filter",
    "refusal",
    AGENT_ERROR_SUBTYPE.invalidRequest,
    AGENT_ERROR_SUBTYPE.maxTurnsExceeded,
    AGENT_ERROR_SUBTYPE.maxToolCallsExceeded,
    AGENT_ERROR_SUBTYPE.budgetExceeded,
    AGENT_ERROR_SUBTYPE.outputSchemaInvalid,
]);

export function isNonRetryableSubtype(subtype: string | null): boolean {
    return subtype !== null && NON_RETRYABLE_SUBTYPES.has(subtype);
}
