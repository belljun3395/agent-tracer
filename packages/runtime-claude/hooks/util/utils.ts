/** Alias for the JSON object type used throughout hook payloads. */
export type JsonObject = Record<string, unknown>;

export interface HookAgentContext {
    agentId?: string;
    agentType?: string;
}

/** Type guard: returns true if `value` is a plain (non-null, non-array) object. */
export function isRecord(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Extracts the `tool_input` field from a hook payload.
 * Returns an empty object when the field is absent or not a plain object.
 * Ref: tool_input is present on PreToolUse, PostToolUse, PostToolUseFailure,
 *      PermissionRequest, PermissionDenied payloads.
 */
export function getToolInput(event: JsonObject): JsonObject {
    return isRecord(event.tool_input) ? event.tool_input : {};
}

/**
 * Returns the session_id from a hook payload, or an empty string if the
 * event originates from a non-Claude runtime source.
 *
 * `hook_source` is an undocumented extension field that may indicate events
 * injected by other systems. We only process events from the official Claude
 * runtime ("claude-hook") to avoid double-counting.
 *
 * Ref: session_id is part of every hook payload's standard base fields.
 * https://code.claude.com/docs/en/hooks#stdin-stdout-protocol
 */
export function getSessionId(event: JsonObject): string {
    const hookSource = toTrimmedString(event.hook_source);
    if (hookSource && hookSource !== "claude-hook") {
        return "";
    }
    return toTrimmedString(event.session_id);
}

/**
 * Returns the hook_event_name from a payload (e.g. "PostToolUse", "SessionStart").
 * Ref: https://code.claude.com/docs/en/hooks#stdin-stdout-protocol
 */
export function getHookEventName(event: JsonObject): string {
    return toTrimmedString(event.hook_event_name);
}

export function getToolName(event: JsonObject): string {
    return toTrimmedString(event.tool_name);
}

export function getToolUseId(event: JsonObject): string | undefined {
    return toOptionalTrimmedString(event.tool_use_id);
}

export function getAgentContext(event: JsonObject): HookAgentContext {
    const agentId = toOptionalTrimmedString(event.agent_id);
    const agentType = toOptionalTrimmedString(event.agent_type);
    return {
        ...(agentId ? { agentId } : {}),
        ...(agentType ? { agentType } : {})
    };
}

export function toTrimmedString(value: unknown, maxLength?: number): string {
    const next = typeof value === "string"
        ? value.trim()
        : (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint")
            ? String(value).trim()
            : "";
    if (!maxLength || next.length <= maxLength) return next;
    return next.slice(0, maxLength);
}

export function toOptionalTrimmedString(value: unknown, maxLength?: number): string | undefined {
    const next = toTrimmedString(value, maxLength);
    return next || undefined;
}

export function toBoolean(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const normalized = toTrimmedString(value).toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function ellipsize(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function sanitizeToolInputValue(value: unknown, maxValueLength: number, depth: number): unknown {
    if (value == null) return value;
    if (typeof value === "string") return toTrimmedString(value, maxValueLength);
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (typeof value === "bigint") return value.toString();
    if (depth >= 4) return "[max-depth]";

    if (Array.isArray(value)) {
        return value.map((entry) => sanitizeToolInputValue(entry, maxValueLength, depth + 1));
    }

    if (isRecord(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, nested]) => [
                key,
                sanitizeToolInputValue(nested, maxValueLength, depth + 1)
            ])
        );
    }

    if (typeof value === "function") {
        return toTrimmedString(value.name ? `[function ${value.name}]` : "[function]", maxValueLength);
    }
    if (typeof value === "symbol") {
        return toTrimmedString(value.description ? `[symbol ${value.description}]` : "[symbol]", maxValueLength);
    }

    return toTrimmedString(Object.prototype.toString.call(value), maxValueLength);
}

export function stringifyToolInput(input: JsonObject, maxValueLength: number = 10000): JsonObject {
    return Object.fromEntries(
        Object.entries(input).map(([key, value]) => [
            key,
            sanitizeToolInputValue(value, maxValueLength, 0)
        ])
    );
}

import * as crypto from "node:crypto";

export function createMessageId(): string {
    return crypto.randomUUID();
}

export function createStableTodoId(content: string, priority: string): string {
    return crypto
        .createHash("sha1")
        .update(`${content}::${priority}`)
        .digest("hex")
        .slice(0, 16);
}
