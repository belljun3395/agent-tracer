import * as path from "node:path";
import {createHookRuntime, type HookRuntime} from "~shared/hook-runtime/index.js";
import {PROJECT_DIR} from "~codex/util/paths.const.js";

/**
 * Shared HookRuntime instance used by every Codex hook script.
 * Centralizes the log-file path and monitor transport so each hook stays
 * a thin file bound to its event schema.
 */
export const codexHookRuntime: HookRuntime = createHookRuntime({
    logFile: path.join(PROJECT_DIR, ".codex", "hooks.log"),
});
