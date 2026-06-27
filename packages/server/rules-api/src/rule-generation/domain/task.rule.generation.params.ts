import type { RuleSuggestionLanguage } from "../application/rule.suggestion.prompt.js";

export const DEFAULT_MAX_RULES = 5;
const MAX_RULES_HARD_CAP = 20;

const SUPPORTED_LANGUAGES: ReadonlySet<RuleSuggestionLanguage> = new Set([
    "auto",
    "ko",
    "en",
    "ja",
    "zh",
]);

export function normalizeRuleSuggestionLanguage(raw: string | null): RuleSuggestionLanguage {
    if (!raw) return "auto";
    const trimmed = raw.trim().toLowerCase() as RuleSuggestionLanguage;
    return SUPPORTED_LANGUAGES.has(trimmed) ? trimmed : "auto";
}

export function clampMaxRules(raw: string | null): number {
    if (!raw) return DEFAULT_MAX_RULES;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_RULES;
    return Math.min(Math.max(n, 1), MAX_RULES_HARD_CAP);
}
