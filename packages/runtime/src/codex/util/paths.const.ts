// Resolved at hook startup from CODEX_PROJECT_DIR env var (set by Codex CLI),
// falling back to the working directory. Used to locate the rollout sessions tree
// and to write the latest-session hint file.
export const PROJECT_DIR = process.env.CODEX_PROJECT_DIR || process.cwd();

// Identifies the event source as the Codex CLI integration in the monitor.
// Stored on every runtime-session-ensure and runtime-session-end request.
export const CODEX_RUNTIME_SOURCE = "codex-cli";
