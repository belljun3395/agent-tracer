import {
    readSessionContext,
    type ClaudeSessionContext,
} from "~runtime/agent/claude-code/payload/context.payload.js";
import {
    readOptionalString,
    requireSessionId,
    type ReaderResult,
} from "~runtime/agent/claude-code/payload/field.payload.js";
import type {JsonObject} from "~runtime/support/json.js";

/** 에이전트 타입이 비면 agent_id를 표시 이름으로 쓴다. */
export interface SubagentPayload extends ClaudeSessionContext {
    readonly subagentType: string;
    readonly stopReason: string | undefined;
    readonly lastAssistantMessage: string | undefined;
}

export interface TaskLifecyclePayload extends ClaudeSessionContext {
    readonly taskName: string;
    readonly taskDescription: string | undefined;
}

function readSubagent(raw: JsonObject): ReaderResult<SubagentPayload> {
    const missing = requireSessionId(raw);
    if (missing) return missing;
    const context = readSessionContext(raw);
    const subagentType = context.agentType ?? readOptionalString(raw, "agent_id");
    if (!subagentType) return {ok: false, reason: "missing agent_type"};
    return {
        ok: true,
        value: {
            payload: raw,
            ...context,
            subagentType,
            stopReason: readOptionalString(raw, "stop_reason"),
            lastAssistantMessage: readOptionalString(raw, "last_assistant_message"),
        },
    };
}

export function readSubagentStart(raw: JsonObject): ReaderResult<SubagentPayload> {
    return readSubagent(raw);
}

export function readSubagentStop(raw: JsonObject): ReaderResult<SubagentPayload> {
    return readSubagent(raw);
}

export function readTaskLifecycle(raw: JsonObject): ReaderResult<TaskLifecyclePayload> {
    const missing = requireSessionId(raw);
    if (missing) return missing;
    const taskName = readOptionalString(raw, "task_name");
    if (!taskName) return {ok: false, reason: "missing task_name"};
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionContext(raw),
            taskName,
            taskDescription: readOptionalString(raw, "task_description"),
        },
    };
}
