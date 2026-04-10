/**
 * Resume ID format: "{runtimeSource}::{sessionId}"
 *
 * Prefixes the Claude Code session_id with a runtime source label so that
 * multiple agent runtimes (e.g. "claude-code", "agent-backend") can coexist
 * in the session history without ID collisions.
 *
 * Example: "claude-code::72537451-6dd3-48b2-b1b4-5102c70ee542"
 */

/**
 * Creates a resume ID with runtime prefix.
 * @param runtimeSource - e.g. "claude-code"
 * @param sessionId     - Claude Code session_id from the hook payload
 */
export function createResumeId(runtimeSource: string, sessionId: string): string {
    return `${runtimeSource}::${sessionId}`;
}
