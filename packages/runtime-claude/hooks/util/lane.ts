/**
 * Timeline lane constants.
 *
 * Re-exports TimelineLane from @monitor/domain and provides a LANE constants object
 * so hook handlers can reference lanes without raw string literals.
 *
 * TimelineLane values:
 *   user           — user messages and prompts
 *   exploration    — file reads, searches, web fetches
 *   planning       — session lifecycle, compaction, context saves
 *   implementation — file edits, shell commands, builds
 *   questions      — questions posed to the user
 *   todos          — task / todo management
 *   background     — background agent tasks
 *   coordination   — agent delegation, MCP calls, skill invocations
 *   telemetry      — API call telemetry and usage metrics
 */
import type { TimelineLane } from "@monitor/domain";

export type { TimelineLane };

export const LANE = {
    user: "user",
    exploration: "exploration",
    planning: "planning",
    implementation: "implementation",
    questions: "questions",
    todos: "todos",
    background: "background",
    coordination: "coordination",
    telemetry: "telemetry",
} as const satisfies Record<TimelineLane, TimelineLane>;
