import * as path from "node:path";

export const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
export const CLAUDE_RUNTIME_SOURCE = "claude-plugin";

export function defaultTaskTitle(): string {
    return `Claude Code — ${path.basename(PROJECT_DIR)}`;
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
    return { server, tool };
}
