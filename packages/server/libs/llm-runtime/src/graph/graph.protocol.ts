import type { AiJobStepPayload } from "@monitor/kernel";
import type { AgentQueryUsage } from "../model/agent.usage.js";

/** LangGraph 실행 백엔드가 돌려주는 HTTP 응답 계약이다. */
export interface AgentGraphResponse {
    readonly data: Record<string, unknown> | null;
    readonly modelUsed: string;
    readonly durationMs: number;
    readonly numTurns: number | null;
    readonly usage: AgentQueryUsage | null;
    readonly error: { readonly subtype: string | null; readonly summary: string } | null;
    readonly steps: readonly AiJobStepPayload[];
    readonly actualModel: string | null;
    readonly providerRequestId: string | null;
}
