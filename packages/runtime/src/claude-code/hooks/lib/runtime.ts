import * as path from "node:path";
import { createHookRuntime } from "~shared/hook-runtime/create-runtime.js";
import type { HookRuntime } from "~shared/hook-runtime/create-runtime.js";
import {PROJECT_DIR} from "~claude-code/hooks/util/paths.const.js";

/**
 * Shared HookRuntime instance used by every Claude Code hook script.
 * Centralizes the log-file path and monitor transport so each hook stays
 * a thin file bound to its event schema.
 */
export const claudeHookRuntime: HookRuntime = createHookRuntime({
    logFile: path.join(PROJECT_DIR, ".claude", "hooks.log"),
});
