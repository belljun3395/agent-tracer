import {
    readOptionalString,
    readRecord,
    readString,
} from "~runtime/agent/claude-code/payload/field.payload.js";
import type {JsonObject} from "~runtime/support/json.js";

/** Claude Code 훅 전반이 stdin으로 함께 받는 세션 문맥이다. */
export interface ClaudeSessionContext {
    readonly payload: JsonObject;
    readonly sessionId: string;
    readonly cwd: string | undefined;
    readonly transcriptPath: string | undefined;
    readonly agentTranscriptPath: string | undefined;
    readonly permissionMode: string | undefined;
    readonly agentId: string | undefined;
    readonly agentType: string | undefined;
}

/** 도구 훅이 세션 문맥에 더해 받는 도구 호출 문맥이다. */
export interface ClaudeToolContext extends ClaudeSessionContext {
    readonly toolName: string;
    readonly toolInput: JsonObject;
    readonly toolUseId: string | undefined;
}

export function hasSessionId(raw: JsonObject): boolean {
    return Boolean(readString(raw, "session_id"));
}

export function readSessionContext(raw: JsonObject): Omit<ClaudeSessionContext, "payload"> {
    return {
        sessionId: readString(raw, "session_id"),
        cwd: readOptionalString(raw, "cwd"),
        transcriptPath: readOptionalString(raw, "transcript_path"),
        agentTranscriptPath: readOptionalString(raw, "agent_transcript_path"),
        permissionMode: readOptionalString(raw, "permission_mode"),
        agentId: readOptionalString(raw, "agent_id"),
        agentType: readOptionalString(raw, "agent_type") ?? readOptionalString(raw, "subagent_type"),
    };
}

export function readToolContext(raw: JsonObject): Omit<ClaudeToolContext, "payload"> {
    return {
        ...readSessionContext(raw),
        toolName: readString(raw, "tool_name"),
        toolInput: readRecord(raw, "tool_input"),
        toolUseId: readOptionalString(raw, "tool_use_id"),
    };
}
