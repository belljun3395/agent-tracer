import { spawn } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { PROJECT_DIR } from "./paths.const.js";
import { isPidRunning, readObserverState } from "./session.state.js";

const RUN_OBSERVER_SCRIPT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../bin/run-observer.sh",
);

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
