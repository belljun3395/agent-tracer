import * as path from "node:path";
import {PROJECT_DIR} from "./paths.const.js";

/** Default task title shown in the monitor when no prompt is available yet. */
export function defaultTaskTitle(): string {
    return `Codex CLI — ${path.basename(PROJECT_DIR)}`;
}

/**
 * Converts an absolute path to a project-relative path.
 * Returns the original path unchanged if it escapes the project root ("..").
 */
export function relativeProjectPath(filePath: string): string {
    if (!filePath) return "";
    if (!path.isAbsolute(filePath)) return filePath;
    const relative = path.relative(PROJECT_DIR, filePath);
    return relative && !relative.startsWith("..") ? relative : filePath;
}
