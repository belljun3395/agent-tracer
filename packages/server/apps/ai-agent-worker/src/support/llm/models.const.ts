export const CLAUDE_MODEL = {
    sonnet: "claude-sonnet-4-6",
    haiku: "claude-haiku-4-5",
} as const;

export type ClaudeModel = (typeof CLAUDE_MODEL)[keyof typeof CLAUDE_MODEL];
