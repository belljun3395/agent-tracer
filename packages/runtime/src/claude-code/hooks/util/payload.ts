import type {JsonObject} from "~claude-code/hooks/util/utils.type.js";
import {isRecord, toOptionalTrimmedString, toTrimmedString} from "~claude-code/hooks/util/utils.js";
import type {HookAgentContext} from "~claude-code/hooks/util/payload.type.js";

export type {HookAgentContext};

/**
 * Extracts the `tool_input` field from the hook event payload.
 * Returns an empty object if the field is absent or not a plain object.
 */
export function getToolInput(event: JsonObject): JsonObject {
    return isRecord(event.tool_input) ? event.tool_input : {};
}

/**
 * Extracts `session_id` from the hook event payload as a trimmed string.
 * Returns an empty string if the payload originates from a non-Claude hook source.
 */
export function getSessionId(event: JsonObject): string {
    const hookSource = toTrimmedString(event.hook_source);
    if (hookSource && hookSource !== "claude-hook") {
        return "";
    }
    return toTrimmedString(event.session_id);
}

/**
 * Extracts the `tool_name` field from the hook event payload as a trimmed string.
 * Returns an empty string if the field is absent.
 */
export function getToolName(event: JsonObject): string {
    return toTrimmedString(event.tool_name);
}

/**
 * Extracts the optional `tool_use_id` field from the hook event payload.
 * Returns `undefined` if the field is absent or empty.
 */
export function getToolUseId(event: JsonObject): string | undefined {
    return toOptionalTrimmedString(event.tool_use_id);
}

/**
 * Extracts `agent_id` and `agent_type` from the hook event payload as a typed `HookAgentContext`.
 * Both fields are optional; absent or empty values are omitted from the returned object.
 */
export function getAgentContext(event: JsonObject): HookAgentContext {
    const agentId = toOptionalTrimmedString(event.agent_id);
    const agentType = toOptionalTrimmedString(event.agent_type);
    return {
        ...(agentId ? {agentId} : {}),
        ...(agentType ? {agentType} : {})
    };
}

/**
 * Parses a tool name in the `"mcp__{server}__{tool}"` format into its `{ server, tool }` parts.
 * Returns `null` if the name does not match the MCP naming convention.
 */
export function parseMcpToolName(toolName: string): { server: string; tool: string } | null {
    if (!toolName.startsWith("mcp__")) return null;
    const parts = toolName.split("__");
    if (parts.length < 3) return null;
    const server = parts[1]?.trim();
    const tool = parts.slice(2).join("__").trim();
    if (!server || !tool) return null;
    return {server, tool};
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

/**
 * Recursively sanitises tool input for safe log output — truncates long string values and limits
 * object recursion to four levels deep. Returns a plain-object copy suitable for logging.
 */
export function stringifyToolInput(input: JsonObject, maxValueLength: number = 10000): JsonObject {
    return Object.fromEntries(
        Object.entries(input).map(([key, value]) => [
            key,
            sanitizeToolInputValue(value, maxValueLength, 0)
        ])
    );
}
