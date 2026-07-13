import { APP_SETTING_KEYS, SETTING_TOGGLE } from "@monitor/kernel";

export const RULE_GENERATION_SETTING_KEYS = {
  apiKey: APP_SETTING_KEYS.anthropicApiKey,
  model: APP_SETTING_KEYS.anthropicModel,
  maxRulesPerTask: APP_SETTING_KEYS.ruleGenMaxRulesPerTask,
  outputLanguage: APP_SETTING_KEYS.claudeOutputLanguage,
  autoOnUserInput: APP_SETTING_KEYS.ruleGenAutoOnUserInput,
} as const;

export const AUTO_RULE_GENERATION = {
  on: SETTING_TOGGLE.on,
  off: SETTING_TOGGLE.off,
} as const;

export const ANTHROPIC_MODEL_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (balanced)" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5 (fast / cheap)" },
  { value: "claude-opus-4-7", label: "Claude Opus 4.7 (most capable)" },
];

export const LANGUAGE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "auto", label: "Auto — match the source text" },
  { value: "ko", label: "Korean" },
  { value: "en", label: "English" },
  { value: "ja", label: "Japanese (日本語)" },
  { value: "zh", label: "Simplified Chinese (简体中文)" },
];
