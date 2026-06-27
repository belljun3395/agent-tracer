/**
 * Claude model IDs the server-side agents pin to. Centralized so a model bump is
 * a single edit here instead of a grep across every agent's DEFAULT_MODEL, and so
 * agents reference a named constant rather than a bare string literal.
 */
export const CLAUDE_MODEL = {
    /** Tool-using, multi-turn workspace agents (rule, recipe). */
    sonnet: "claude-sonnet-4-6",
    /** 1-shot, no-workspace agents (title, cleanup). */
    haiku: "claude-haiku-4-5",
} as const;
