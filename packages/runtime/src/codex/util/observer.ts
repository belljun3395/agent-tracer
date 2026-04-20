/**
 * Codex Observer Launcher
 *
 * Ensures the Codex observer process (observe.ts) is running for the given
 * session. Called by the SessionStart hook after session creation.
 *
 * The observer is spawned as a detached background process so it outlives the
 * short-lived hook process. Only one observer per project directory is allowed;
 * if a stale observer from a different session is detected it is replaced.
 */
import {spawn} from "node:child_process";
import * as path from "node:path";
import {fileURLToPath} from "node:url";
import {PROJECT_DIR} from "./paths.const.js";
import {isPidRunning, readObserverState} from "./session.state.js";

const RUN_OBSERVER_SCRIPT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../bin/run-observer.sh",
);

/**
 * Ensures the observer is running for `sessionId` under `projectDir`.
 *
 * - "unchanged" — existing observer is alive for this session; nothing to do.
 * - "restarted" — previous observer (different session or dead) was replaced.
 * - "started"   — no prior observer existed; a new one was launched.
 *
 * Uses SIGTERM for best-effort termination of a stale observer; errors are
 * swallowed because the new spawn will take over regardless.
 */
export async function ensureObserverRunning(
    sessionId: string,
    projectDir: string = PROJECT_DIR,
): Promise<"started" | "restarted" | "unchanged"> {
    const existing = await readObserverState(projectDir);
    if (existing && isPidRunning(existing.pid)) {
        if (existing.sessionId === sessionId) {
            return "unchanged";
        }
        try {
            process.kill(existing.pid, "SIGTERM");
        } catch {
            // Best effort replacement only.
        }
    }

    const child = spawn("/usr/bin/env", [
        "bash",
        RUN_OBSERVER_SCRIPT,
        "--project-dir",
        projectDir,
        "--session-marker",
        sessionId,
        "--quiet",
    ], {
        detached: true,
        stdio: "ignore",
        env: process.env,
    });

    child.unref();
    return existing ? "restarted" : "started";
}
