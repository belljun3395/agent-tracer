import type {AiJobStepToolCall} from "@monitor/kernel/job/job.step.const.js";
import type {RuleGenerationUsage} from "~runtime/domain/rulegen/model/rule.job.model.js";

// 실행기가 성공을 알리는 종료 부호이며 나머지 부호는 전부 실패다.
export const RULE_AGENT_RESULT_SUCCESS = "success";

/** 모델이 낸 한 번의 응답이며 텍스트와 이번에 결정한 도구 호출을 함께 싣는다. */
export interface RuleAgentAssistantMessage {
    readonly type: "assistant";
    readonly text: string;
    readonly toolCalls: readonly AiJobStepToolCall[];
    readonly usage: RuleGenerationUsage | null;
    readonly stopReason: string | null;
}

/** 도구가 모델에게 돌려준 응답이며 도구 이름은 호출 ID로만 이어진다. */
export interface RuleAgentToolResultMessage {
    readonly type: "tool_result";
    readonly toolCallId: string;
    readonly text: string;
}

/** 실행이 끝났음을 알리는 마지막 메시지이며 성공이든 실패든 이번 실행의 비용을 싣는다. */
export interface RuleAgentResultMessage {
    readonly type: "result";
    readonly subtype: string;
    readonly structuredOutput: unknown;
    readonly errors: readonly string[];
    readonly costUsd: number | null;
    readonly numTurns: number | null;
    readonly usage: RuleGenerationUsage | null;
}

export type RuleAgentMessage =
    | RuleAgentAssistantMessage
    | RuleAgentToolResultMessage
    | RuleAgentResultMessage;
