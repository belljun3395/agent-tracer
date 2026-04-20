import * as path from "node:path";
import { PROJECT_DIR } from "./paths.const.js";

export function defaultTaskTitle(): string {
    return `Codex CLI — ${path.basename(PROJECT_DIR)}`;
}

export function relativeProjectPath(filePath: string): string {
    if (!filePath) return "";
    if (!path.isAbsolute(filePath)) return filePath;
    const relative = path.relative(PROJECT_DIR, filePath);
    return relative && !relative.startsWith("..") ? relative : filePath;
}
