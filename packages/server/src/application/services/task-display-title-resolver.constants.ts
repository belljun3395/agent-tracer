export const GENERIC_TASK_TITLE_PREFIXES = new Set([
  "agent",
  "ai cli",
  "aider",
  "claude",
  "claude code",
  "codex",
  "cursor",
  "gemini",
  "gemini cli",
  "open code",
  "opencode"
]);

export const MAX_TASK_TITLE_LENGTH = 120;

export const TRAILING_SESSION_SUFFIX_PATTERN = /\s+\((?:ses_[^)]+|session[^)]*|sess[^)]*)\)\s*$/i;

export const GENERIC_TASK_TITLE_PREFIX_SPLIT_PATTERN = /\s+[—–-]\s+/;

export function isAgentSessionBoilerplatePrefix(value: string): boolean {
  return /^(claude code|claude|opencode|open code|codex|cursor|gemini(?: cli)?|agent|ai cli) session started\b/.test(value)
    || /^(claude code|claude|opencode|open code|codex|cursor|gemini(?: cli)?|agent|ai cli) - /.test(value);
}

export function normalizeTaskTitleToken(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
