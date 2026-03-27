import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

export type JsonObject = Record<string, unknown>;

interface RuntimeSessionEnsureResult {
    readonly taskId: string;
    readonly sessionId: string;
}

const API_BASE = `http://127.0.0.1:${process.env.MONITOR_PORT || "3847"}`;

// Codex passes the working directory in the `cwd` field of the hook payload.
// We fall back to process.cwd() when running outside a hook context.
export let PROJECT_DIR = process.env.CODEX_PROJECT_DIR || process.cwd();

export const CODEX_RUNTIME_SOURCE = "codex-hook";

export function setProjectDir(dir: string): void {
    if (dir) PROJECT_DIR = dir;
}

export function defaultTaskTitle(): string {
    return `Codex — ${path.basename(PROJECT_DIR)}`;
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
        headers: { "Content-Type": "application/json" },
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
    title: string = defaultTaskTitle(),
    opts?: { parentTaskId?: string; parentSessionId?: string }
): Promise<RuntimeSessionEnsureResult> {
    return postJson<RuntimeSessionEnsureResult>("/api/runtime-session-ensure", {
        runtimeSource: CODEX_RUNTIME_SOURCE,
        runtimeSessionId,
        title,
        workspacePath: PROJECT_DIR,
        ...(opts?.parentTaskId ? { parentTaskId: opts.parentTaskId } : {}),
        ...(opts?.parentSessionId ? { parentSessionId: opts.parentSessionId } : {})
    });
}

export function isRecord(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getToolInput(event: JsonObject): JsonObject {
    return isRecord(event.tool_input) ? event.tool_input : {};
}

// Codex does not set hook_source — just return session_id directly.
export function getSessionId(event: JsonObject): string {
    return toTrimmedString(event.session_id);
}

export function getHookEventName(event: JsonObject): string {
    return toTrimmedString(event.hook_event_name);
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

export function toBoolean(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const normalized = toTrimmedString(value).toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
}

export interface SemanticMetadata {
    readonly subtypeKey: string;
    readonly subtypeLabel?: string;
    readonly subtypeGroup: string;
    readonly toolFamily: string;
    readonly operation: string;
    readonly entityType?: string;
    readonly entityName?: string;
    readonly sourceTool?: string;
    readonly importance?: string;
}

export function buildSemanticMetadata(input: SemanticMetadata): JsonObject {
    return {
        subtypeKey: input.subtypeKey,
        subtypeLabel: input.subtypeLabel ?? humanizeSubtypeKey(input.subtypeKey),
        subtypeGroup: input.subtypeGroup,
        toolFamily: input.toolFamily,
        operation: input.operation,
        ...(input.entityType ? { entityType: input.entityType } : {}),
        ...(input.entityName ? { entityName: input.entityName } : {}),
        ...(input.sourceTool ? { sourceTool: input.sourceTool } : {}),
        ...(input.importance ? { importance: input.importance } : {})
    };
}

export interface CommandSemantic {
    readonly lane: "exploration" | "implementation";
    readonly metadata: SemanticMetadata;
}

export function inferCommandSemantic(command: string): CommandSemantic {
    const normalized = command.trim().toLowerCase();
    const commandToken = firstCommandToken(command);
    const commandEntity = commandToken || "shell";

    if (
        /^(pwd|ls|tree|find|fd|rg|grep|cat|sed|head|tail|wc|stat|file|which|whereis)\b/.test(normalized)
        || /^git\s+(status|diff|show|log)\b/.test(normalized)
        || /^(npm|pnpm|yarn|bun)\s+(ls|list)\b/.test(normalized)
    ) {
        return {
            lane: "exploration",
            metadata: {
                subtypeKey: "shell_probe",
                subtypeLabel: "Shell probe",
                subtypeGroup: "shell",
                toolFamily: "terminal",
                operation: "probe",
                entityType: "command",
                entityName: commandEntity,
                sourceTool: "Bash"
            }
        };
    }

    if (/\b(pytest|vitest|jest|ava|mocha|phpunit|rspec)\b/.test(normalized)
        || /\b(npm|pnpm|yarn|bun)\s+(run\s+)?test\b/.test(normalized)
        || /\b(go|cargo)\s+test\b/.test(normalized)) {
        return {
            lane: "implementation",
            metadata: {
                subtypeKey: "run_test",
                subtypeLabel: "Run test",
                subtypeGroup: "execution",
                toolFamily: "terminal",
                operation: "execute",
                entityType: "command",
                entityName: commandEntity,
                sourceTool: "Bash"
            }
        };
    }

    if (/\b(eslint|ruff|flake8|prettier|biome)\b/.test(normalized)
        || /\b(npm|pnpm|yarn|bun)\s+(run\s+)?lint\b/.test(normalized)) {
        return {
            lane: "implementation",
            metadata: {
                subtypeKey: "run_lint",
                subtypeLabel: "Run lint",
                subtypeGroup: "execution",
                toolFamily: "terminal",
                operation: "execute",
                entityType: "command",
                entityName: commandEntity,
                sourceTool: "Bash"
            }
        };
    }

    if (/\b(npm|pnpm|yarn|bun)\s+(run\s+)?build\b/.test(normalized)
        || /\b(cargo|go)\s+build\b/.test(normalized)
        || /\btsc\b/.test(normalized)) {
        return {
            lane: "implementation",
            metadata: {
                subtypeKey: "run_build",
                subtypeLabel: "Run build",
                subtypeGroup: "execution",
                toolFamily: "terminal",
                operation: "execute",
                entityType: "command",
                entityName: commandEntity,
                sourceTool: "Bash"
            }
        };
    }

    return {
        lane: "implementation",
        metadata: {
            subtypeKey: "run_command",
            subtypeLabel: "Run command",
            subtypeGroup: "execution",
            toolFamily: "terminal",
            operation: "execute",
            entityType: "command",
            entityName: commandEntity,
            sourceTool: "Bash"
        }
    };
}

export function inferExploreSemantic(toolName: string, toolInput: JsonObject): SemanticMetadata {
    const normalized = toolName.trim().toLowerCase();
    const filePath = extractToolFilePath(toolInput);
    const entityName = filePath ? relativeProjectPath(filePath) : undefined;

    if (normalized === "read" || normalized.includes("view") || normalized.includes("open")) {
        return {
            subtypeKey: "read_file",
            subtypeLabel: "Read file",
            subtypeGroup: "files",
            toolFamily: "explore",
            operation: "read",
            entityType: "file",
            ...(entityName ? { entityName } : {}),
            sourceTool: toolName
        };
    }

    if (normalized.includes("glob")) {
        return {
            subtypeKey: "glob_files",
            subtypeLabel: "Glob files",
            subtypeGroup: "search",
            toolFamily: "explore",
            operation: "search",
            entityType: "file",
            ...(entityName ? { entityName } : {}),
            sourceTool: toolName
        };
    }

    if (normalized.includes("grep")) {
        return {
            subtypeKey: "grep_code",
            subtypeLabel: "Grep code",
            subtypeGroup: "search",
            toolFamily: "explore",
            operation: "search",
            entityType: "file",
            ...(entityName ? { entityName } : {}),
            sourceTool: toolName
        };
    }

    if (normalized.includes("webfetch") || normalized.includes("open_page")) {
        return {
            subtypeKey: "web_fetch",
            subtypeLabel: "Web fetch",
            subtypeGroup: "web",
            toolFamily: "explore",
            operation: "fetch",
            entityType: "url",
            entityName: toTrimmedString(toolInput.url) || toTrimmedString(toolInput.query),
            sourceTool: toolName
        };
    }

    if (normalized.includes("websearch") || normalized.includes("search") || normalized.includes("find_in_page")) {
        return {
            subtypeKey: "web_search",
            subtypeLabel: "Web search",
            subtypeGroup: "web",
            toolFamily: "explore",
            operation: "search",
            entityType: "query",
            entityName: toTrimmedString(toolInput.query),
            sourceTool: toolName
        };
    }

    return {
        subtypeKey: "list_files",
        subtypeLabel: "List files",
        subtypeGroup: "search",
        toolFamily: "explore",
        operation: "list",
        entityType: "file",
        ...(entityName ? { entityName } : {}),
        sourceTool: toolName
    };
}

export function inferFileToolSemantic(toolName: string, toolInput: JsonObject): SemanticMetadata {
    const normalized = toolName.trim().toLowerCase();
    const filePath = extractToolFilePath(toolInput);
    const entityName = filePath ? relativeProjectPath(filePath) : undefined;

    if (normalized.includes("patch")) {
        return {
            subtypeKey: "apply_patch",
            subtypeLabel: "Apply patch",
            subtypeGroup: "file_ops",
            toolFamily: "file",
            operation: "patch",
            entityType: "file",
            ...(entityName ? { entityName } : {}),
            sourceTool: toolName
        };
    }

    if (normalized.includes("rename") || normalized.includes("move")) {
        return {
            subtypeKey: "rename_file",
            subtypeLabel: "Rename file",
            subtypeGroup: "file_ops",
            toolFamily: "file",
            operation: "rename",
            entityType: "file",
            ...(entityName ? { entityName } : {}),
            sourceTool: toolName
        };
    }

    if (normalized.includes("delete") || normalized.includes("remove")) {
        return {
            subtypeKey: "delete_file",
            subtypeLabel: "Delete file",
            subtypeGroup: "file_ops",
            toolFamily: "file",
            operation: "delete",
            entityType: "file",
            ...(entityName ? { entityName } : {}),
            sourceTool: toolName
        };
    }

    if (normalized.includes("write") || normalized.includes("create")) {
        return {
            subtypeKey: "create_file",
            subtypeLabel: "Create file",
            subtypeGroup: "file_ops",
            toolFamily: "file",
            operation: "create",
            entityType: "file",
            ...(entityName ? { entityName } : {}),
            sourceTool: toolName
        };
    }

    return {
        subtypeKey: "modify_file",
        subtypeLabel: "Modify file",
        subtypeGroup: "file_ops",
        toolFamily: "file",
        operation: "modify",
        entityType: "file",
        ...(entityName ? { entityName } : {}),
        sourceTool: toolName
    };
}

export function ellipsize(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function createMessageId(): string {
    return crypto.randomUUID();
}

export function relativeProjectPath(filePath: string): string {
    if (filePath.startsWith(PROJECT_DIR)) {
        return filePath.slice(PROJECT_DIR.length).replace(/^\/+/, "");
    }
    return filePath;
}

const LOG_FILE = path.join(PROJECT_DIR, ".codex", "hooks.log");
const LOG_ENABLED = process.env.NODE_ENV === "development";

function appendLog(line: string): void {
    if (!LOG_ENABLED) return;
    try {
        fs.appendFileSync(LOG_FILE, line + "\n");
    } catch {
        // ignore
    }
}

export function hookLog(hookName: string, message: string, data?: Record<string, unknown>): void {
    const ts = new Date().toISOString().slice(11, 23);
    const dataStr = data ? ` ${JSON.stringify(data)}` : "";
    const line = `[${ts}][HOOK:${hookName}] ${message}${dataStr}`;
    if (LOG_ENABLED) {
        process.stderr.write(line + "\n");
    }
    appendLog(line);
}

export function hookLogPayload(hookName: string, payload: JsonObject): void {
    const ts = new Date().toISOString().slice(11, 23);
    const rest = { ...payload };
    delete rest.tool_response;
    delete rest.transcript_path;

    if (isRecord(rest.tool_input)) {
        rest.tool_input = Object.fromEntries(
            Object.entries(rest.tool_input).map(([k, v]) =>
                typeof v === "string" && v.length > 200
                    ? [k, v.slice(0, 200) + "…"]
                    : [k, v]
            )
        );
    }

    appendLog(`[${ts}][PAYLOAD:${hookName}] ${JSON.stringify(rest)}`);
}

function firstCommandToken(command: string): string {
    const [first = ""] = command.trim().split(/\s+/, 1);
    return first.replace(/^['"]+|['"]+$/g, "");
}

function extractToolFilePath(toolInput: JsonObject): string {
    return toTrimmedString(toolInput.file_path)
        || toTrimmedString(toolInput.path)
        || toTrimmedString(toolInput.pattern);
}

function humanizeSubtypeKey(value: string): string {
    return value
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}
