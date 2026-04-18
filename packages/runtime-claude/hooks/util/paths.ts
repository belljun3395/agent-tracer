import * as path from "node:path";

/**
 * Absolute path of the project root.
 * Populated from the $CLAUDE_PROJECT_DIR environment variable that Claude Code
 * exports to every hook subprocess. Falls back to cwd() in development.
 * Ref: https://code.claude.com/docs/en/hooks#environmental-variables-paths
 */
export const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();

/** Identifies events originating from this plugin in the Agent Tracer monitor. */
export const CLAUDE_RUNTIME_SOURCE = "claude-plugin";

/**
 * Directory for per-session transcript cursor files.
 *
 * The transcript cursor is the only FS state the plugin still maintains:
 * it tracks the last-processed byte offset in Claude Code's append-only
 * transcript JSONL so each Stop/SubagentStop hook can tail only new
 * entries. Session-result caches and session-history were removed in
 * Phase 6 (server is the single source of truth); the cursor keeps its
 * own dedicated directory so the old `.session-cache/` concept is fully
 * retired.
 *
 * Legacy location (pre-v0.2.0): `<PROJECT_DIR>/.claude/.session-cache/<sessionId>-transcript-cursor.json`.
 * transcript-cursor.ts still reads that path as a migration fallback.
 */
export const TRANSCRIPT_CURSOR_DIR = `${PROJECT_DIR}/.claude/.transcript-cursors`;
/** Legacy session-cache directory; read-only fallback used during migration. */
export const LEGACY_SESSION_CACHE_DIR = `${PROJECT_DIR}/.claude/.session-cache`;

export function defaultTaskTitle(): string {
    return `Claude Code — ${path.basename(PROJECT_DIR)}`;
}

export function relativeProjectPath(filePath: string): string {
    if (!filePath) return filePath;

    const relative = path.relative(PROJECT_DIR, filePath);
    if (!relative) return "";

    const normalizedRelative = relative.split(path.sep).join("/");
    if (
        normalizedRelative === ".." ||
        normalizedRelative.startsWith("../") ||
        path.isAbsolute(relative)
    ) {
        return filePath;
    }

    return normalizedRelative.replace(/^\/+/, "");
}

export function parseMcpToolName(toolName: string): { server: string; tool: string } | null {
    if (!toolName.startsWith("mcp__")) return null;
    const parts = toolName.split("__");
    if (parts.length < 3) return null;
    const server = parts[1]?.trim();
    const tool = parts.slice(2).join("__").trim();
    if (!server || !tool) return null;
    return { server, tool };
}
