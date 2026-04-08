import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

export type JsonObject = Record<string, unknown>;

interface RuntimeSessionEnsureResult {
    readonly taskId: string;
    readonly sessionId: string;
}

const API_BASE = `http://127.0.0.1:${process.env.MONITOR_PORT || "3847"}`;

export const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
// CLAUDE_PROJECT_DIR may be absent when hook commands use relative paths.
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
    title: string = defaultTaskTitle(),
    opts?: { parentTaskId?: string; parentSessionId?: string; taskId?: string }
): Promise<RuntimeSessionEnsureResult> {
    return postJson<RuntimeSessionEnsureResult>("/api/runtime-session-ensure", {
        ...(opts?.taskId ?? process.env.MONITOR_TASK_ID ? { taskId: opts?.taskId ?? process.env.MONITOR_TASK_ID } : {}),
        runtimeSource: CLAUDE_RUNTIME_SOURCE,
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

export function getSessionId(event: JsonObject): string {
    const hookSource = toTrimmedString(event.hook_source);
    if (hookSource && hookSource !== "claude-hook") {
        return "";
    }
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

export interface CommandSemantic {
    readonly lane: "exploration" | "implementation";
    readonly metadata: SemanticMetadata;
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

export function inferCommandLane(command: string): "exploration" | "implementation" {
    return inferCommandSemantic(command).lane;
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

    if (/\b(rule|policy|guard|constraint|conformance)\b/.test(normalized)) {
        return {
            lane: "implementation",
            metadata: {
                subtypeKey: "rule_check",
                subtypeLabel: "Rule check",
                subtypeGroup: "execution",
                toolFamily: "terminal",
                operation: "execute",
                entityType: "command",
                entityName: commandEntity,
                sourceTool: "Bash"
            }
        };
    }

    if (
        /\b(pytest|vitest|jest|ava|mocha|phpunit|rspec)\b/.test(normalized)
        || /\b(npm|pnpm|yarn|bun)\s+(run\s+)?test\b/.test(normalized)
        || /\b(go|cargo)\s+test\b/.test(normalized)
        || /\bplaywright\s+test\b/.test(normalized)
        || /\bcypress\s+run\b/.test(normalized)
    ) {
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

    if (
        /\b(eslint|stylelint|ruff|flake8|prettier|biome|oxlint)\b/.test(normalized)
        || /\b(npm|pnpm|yarn|bun)\s+(run\s+)?lint\b/.test(normalized)
        || /\b(cargo|go)\s+fmt\b/.test(normalized)
    ) {
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

    if (
        /\b(typecheck|type-check|check-types|verify|validate|doctor|audit)\b/.test(normalized)
        || /\btsc\b.*\b--noemit\b/.test(normalized)
        || /\bcargo\s+check\b/.test(normalized)
        || /\bgo\s+vet\b/.test(normalized)
        || /\bmypy\b/.test(normalized)
    ) {
        return {
            lane: "implementation",
            metadata: {
                subtypeKey: "verify",
                subtypeLabel: "Verify",
                subtypeGroup: "execution",
                toolFamily: "terminal",
                operation: "execute",
                entityType: "command",
                entityName: commandEntity,
                sourceTool: "Bash"
            }
        };
    }

    if (
        /\b(npm|pnpm|yarn|bun)\s+(run\s+)?build\b/.test(normalized)
        || /\b(next|vite|webpack|rollup)\s+build\b/.test(normalized)
        || /\bcargo\s+build\b/.test(normalized)
        || /\bgo\s+build\b/.test(normalized)
        || /\bdocker\s+build\b/.test(normalized)
        || /\btsc\b/.test(normalized)
    ) {
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

    if (normalized.includes("webfetch")) {
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

    if (normalized.includes("websearch")) {
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

export function stringifyToolInput(input: JsonObject, maxValueLength: number = 10000): Record<string, string> {
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

function extractToolFilePath(toolInput: JsonObject): string {
    return toTrimmedString(toolInput.file_path)
        || toTrimmedString(toolInput.path)
        || toTrimmedString(toolInput.pattern);
}

function firstCommandToken(command: string): string {
    const [first = ""] = command.trim().split(/\s+/, 1);
    return first.replace(/^['"]+|['"]+$/g, "");
}

function humanizeSubtypeKey(value: string): string {
    return value
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

const LOG_FILE = path.join(PROJECT_DIR, ".claude", "hooks.log");

// ─── Subagent Registry ───────────────────────────────────────────────────────
// SubagentStart 시 agent_id → parentSessionId 매핑을 파일로 저장.
// ensure_task.ts에서 자식 session과 부모 task를 연결할 때 사용.

const SUBAGENT_REGISTRY_FILE = path.join(PROJECT_DIR, ".claude", ".subagent-registry.json");

export interface SubagentRegistryEntry {
    parentSessionId: string;
    agentType: string;
    linked: boolean;
    /** OpenCode background session용: monitor task ID of parent (opencode-plugin이 기록) */
    parentTaskId?: string;
}

export type SubagentRegistry = Record<string, SubagentRegistryEntry>;

export function readSubagentRegistry(): SubagentRegistry {
    try {
        const raw = fs.readFileSync(SUBAGENT_REGISTRY_FILE, "utf-8");
        const parsed = JSON.parse(raw) as unknown;
        return isRecord(parsed) ? (parsed as SubagentRegistry) : {};
    } catch {
        return {};
    }
}

export function writeSubagentRegistry(registry: SubagentRegistry): void {
    try {
        fs.writeFileSync(SUBAGENT_REGISTRY_FILE, JSON.stringify(registry, null, 2));
    } catch {
        // 파일 쓰기 실패해도 hook 동작에 영향 없도록 무시
    }
}

const LOG_ENABLED = process.env.NODE_ENV === "development";

function appendLog(line: string): void {
    if (!LOG_ENABLED) return;
    try {
        fs.appendFileSync(LOG_FILE, line + "\n");
    } catch {
        // 파일 쓰기 실패해도 hook 동작에 영향 없도록 무시
    }
}

/**
 * Hook 디버그 로그. stderr + 파일(.claude/hooks.log) 동시 출력.
 */
export function hookLog(hookName: string, message: string, data?: Record<string, unknown>): void {
    const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
    const dataStr = data ? ` ${JSON.stringify(data)}` : "";
    const line = `[${ts}][HOOK:${hookName}] ${message}${dataStr}`;
    if (process.env["NODE_ENV"] === "development") {
        process.stderr.write(line + "\n");
    }
    appendLog(line);
}

/**
 * Hook이 stdin으로 받은 원본 payload를 로그 파일에 기록.
 * tool_response / transcript_path 같은 덩치 큰 필드는 제거하고,
 * tool_input 문자열 값은 200자로 잘라 읽기 좋게 기록.
 * 각 hook main()의 맨 앞에서 호출.
 */
export function hookLogPayload(hookName: string, payload: JsonObject): void {
    const ts = new Date().toISOString().slice(11, 23);

    // 덩치 큰 필드 제거
    const { tool_response: _tr, transcript_path: _tp, ...rest } = payload;

    // tool_input 문자열 값 200자 truncate
    if (isRecord(rest.tool_input)) {
        rest.tool_input = Object.fromEntries(
            Object.entries(rest.tool_input).map(([k, v]) =>
                typeof v === "string" && v.length > 200
                    ? [k, v.slice(0, 200) + "…"]
                    : [k, v]
            )
        );
    }

    const line = `[${ts}][PAYLOAD:${hookName}] ${JSON.stringify(rest)}`;
    appendLog(line);
}
