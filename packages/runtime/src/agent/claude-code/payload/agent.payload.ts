import {
    hasSessionId,
    readSessionContext,
    type ClaudeSessionContext,
} from "~runtime/agent/claude-code/payload/context.payload.js";
import {
    readOptionalString,
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

function readSubagentType(raw: JsonObject): string | undefined {
    return readOptionalString(raw, "agent_type")
        ?? readOptionalString(raw, "subagent_type")
        ?? readOptionalString(raw, "agent_id");
}

function readSubagent(raw: JsonObject): ReaderResult<SubagentPayload> {
    if (!hasSessionId(raw)) return {ok: false, reason: "missing session_id"};
    const subagentType = readSubagentType(raw);
    if (!subagentType) return {ok: false, reason: "missing agent_type"};
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionContext(raw),
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
    if (!hasSessionId(raw)) return {ok: false, reason: "missing session_id"};
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
