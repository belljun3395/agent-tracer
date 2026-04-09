/**
 * Builds the CLI command a user can run to resume a recorded runtime session.
 *
 * Returns null when the runtime source is unknown or no sessionId is available —
 * the caller decides how to render the fallback (e.g. show only the raw ID).
 *
 * Verified against:
 *  - claude --resume <id>      (Claude Code official docs)
 *  - codex resume <id>         (codex resume --help, positional UUID/thread name)
 */

export interface ResumeCommandSpec {
  /** Human-readable label, e.g. "Claude Code", "Codex". */
  readonly label: string;
  /** Full shell command line that resumes the session. */
  readonly command: string;
}

export function buildResumeCommand(
  runtimeSource: string | undefined,
  sessionId: string | undefined
): ResumeCommandSpec | null {
  if (!sessionId) return null;
  switch (runtimeSource) {
    case "claude-hook":
    case "claude-plugin":
      return { label: "Claude Code", command: `claude --resume ${sessionId}` };
    case "codex-skill":
      return { label: "Codex", command: `codex resume ${sessionId}` };
    default:
      return null;
  }
}
