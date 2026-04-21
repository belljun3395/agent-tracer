import * as path from "node:path";
import {PROJECT_DIR} from "./paths.const.js";

/** Default task title shown in the monitor when no prompt is available yet. */
export function defaultTaskTitle(): string {
    return `Codex CLI — ${path.basename(PROJECT_DIR)}`;
}
