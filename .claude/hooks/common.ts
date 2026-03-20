import crypto from "node:crypto";
import path from "node:path";

export type JsonObject = Record<string, unknown>;

interface RuntimeSessionEnsureResult {
    readonly taskId: string;
    readonly sessionId: string;
}

const API_BASE = `http://127.0.0.1:${process.env.MONITOR_PORT || "3847"}`;
const OPENCODE_RUNTIME = Boolean(process.env.OPENCODE || process.env.OPENCODE_CLIENT);

export const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
// CLAUDE_PROJECT_DIR may be absent when hook commands use relative paths.
export const CLAUDE_RUNTIME = !OPENCODE_RUNTIME;
export const CLAUDE_RUNTIME_SOURCE = "claude-hook";


export function defaultTaskTitle(): string {
    return `Claude Code — ${path.basename(PROJECT_DIR)}`;
}

export async function readStdinJson(): Promise<JsonObject> {
    let raw = "";
    for await (const chunk of process.stdin) {
        raw += String(chunk);
    }
    if (!raw.trim()) return {};
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : {};
}

export async function postJson<T = JsonObject>(pathname: string, body: JsonObject): Promise<T> {
    const response = await fetch(`${API_BASE}${pathname}`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(1_000)
    });
    if (!response.ok) {
        throw new Error(`Monitor request failed: ${pathname} (${response.status})`);
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as T;
}

export async function ensureRuntimeSession(
    runtimeSessionId: string,
    title: string = defaultTaskTitle()
): Promise<RuntimeSessionEnsureResult> {
    return postJson<RuntimeSessionEnsureResult>("/api/runtime-session-ensure", {
        runtimeSource: CLAUDE_RUNTIME_SOURCE,
        runtimeSessionId,
        title,
        workspacePath: PROJECT_DIR
    });
}

export function isRecord(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getToolInput(event: JsonObject): JsonObject {
    return isRecord(event.tool_input) ? event.tool_input : {};
}

export function getSessionId(event: JsonObject): string {
    return toTrimmedString(event.session_id);
}

export function getHookEventName(event: JsonObject): string {
    return toTrimmedString(event.hook_event_name);
}

export function toTrimmedString(value: unknown, maxLength?: number): string {
    const next = typeof value === "string" ? value.trim() : String(value ?? "").trim();
    if (!maxLength || next.length <= maxLength) return next;
    return next.slice(0, maxLength);
}

export function toBoolean(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const normalized = toTrimmedString(value).toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function inferCommandLane(_command: string): "implementation" {
    return "implementation";
}

export function ellipsize(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function stringifyToolInput(input: JsonObject, maxValueLength: number = 200): Record<string, string> {
    return Object.fromEntries(
        Object.entries(input).map(([key, value]) => [key, toTrimmedString(value, maxValueLength)])
    );
}

export function relativeProjectPath(filePath: string): string {
    if (filePath.startsWith(PROJECT_DIR)) {
        return filePath.slice(PROJECT_DIR.length).replace(/^\/+/, "");
    }
    return filePath;
}


export function parseMcpToolName(toolName: string): { server: string; tool: string } | null {
    if (!toolName.startsWith("mcp__")) return null;
    const parts = toolName.split("__");
    if (parts.length < 3) return null;
    const server = parts[1]?.trim();
    const tool = parts.slice(2).join("__").trim();
    if (!server || !tool) return null;
    return {server, tool};
}

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
