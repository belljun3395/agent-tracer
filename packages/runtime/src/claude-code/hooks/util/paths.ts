import * as path from "node:path";
import {PROJECT_DIR} from "~claude-code/hooks/util/paths.const.js";

/**
 * Returns the default task title for the current project, formatted as `"Claude Code — {project-name}"`.
 * The project name is derived from the base directory name of `PROJECT_DIR`.
 */
export function defaultTaskTitle(): string {
    return `Claude Code — ${path.basename(PROJECT_DIR)}`;
}

/**
 * Converts an absolute file path to a project-relative path by stripping the `PROJECT_DIR` prefix.
 * Falls back to the original path if the file is not located under the project root.
 */
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
