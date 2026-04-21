export const GENERIC_TASK_TITLE_PREFIXES = new Set([
    "agent",
    "ai cli",
    "aider",
    "claude",
    "claude code",
    "codex",
    "codex app server",
    "codex app-server",
    "codex cli"
]);
export const MAX_TASK_TITLE_LENGTH = 120;
export const TRAILING_SESSION_SUFFIX_PATTERN = /\s+\((?:ses_[^)]+|session[^)]*|sess[^)]*)\)\s*$/i;
export const GENERIC_TASK_TITLE_PREFIX_SPLIT_PATTERN = /\s+[—–-]\s+/;
export function isAgentSessionBoilerplatePrefix(value: string): boolean {
    return /^(claude code|claude|codex app-server|codex app server|codex cli|codex|agent|ai cli) session started\b/.test(value)
        || /^(claude code|claude|codex app-server|codex app server|codex cli|codex|agent|ai cli) - /.test(value);
}
