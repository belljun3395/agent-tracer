import {
  createGuidanceMessage,
  guidanceCode,
  guidanceStrong,
} from "~web/shared/guidance-message.js";

export const EN_SETTINGS = {
  introduction: createGuidanceMessage(
    "Server settings are stored in PostgreSQL. Sensitive values are encrypted with AES-256-GCM and shown masked after save; enter a new value to replace one.",
  ),
  securityNote: createGuidanceMessage(
    "Sensitive settings are encrypted with AES-256-GCM using ",
    guidanceCode("MONITOR_SETTINGS_ENCRYPTION_KEY"),
    ". Configure that key outside local development. The built-in development fallback is not suitable for shared or production environments.",
  ),
  guidanceLanguage: createGuidanceMessage(
    "Changes explanatory text in this browser. Controls, status labels, and recorded agent content remain in English or in their original language.",
  ),
  identityIntroduction: createGuidanceMessage(
    "Tasks and events are grouped by user. The default ",
    guidanceCode("local"),
    " identity needs no setup. Set an email to separate this browser activity and attribute Claude Code hook events to the same user.",
  ),
  identityStorage: createGuidanceMessage(
    "Stored only in this browser. Changing it reloads the page.",
  ),
  identityReset: createGuidanceMessage(
    "This browser's user identity will be cleared and changed back to ",
    guidanceCode("local"),
    ".",
  ),
  hookSetup: (email: string) =>
    createGuidanceMessage(
      "Add this value to the Claude Code environment so hook events are attributed to ",
      guidanceStrong(email),
      ". Without it, hook activity is recorded as the ",
      guidanceCode("local"),
      " user.",
    ),
  ruleGenerationIntroduction: createGuidanceMessage(
    "Provider credentials configure server-side AI jobs and rule generation. Without an API key, use ",
    guidanceCode("/rule"),
    " in Claude Code to run the local generator with the CLI's own authentication.",
  ),
  localRuleTrigger: createGuidanceMessage(
    "When enabled, the local daemon proposes task-scoped rules only for messages that start with ",
    guidanceCode("/rule"),
    ". It uses the local Claude Code CLI, needs no API key, and skips a task while an earlier pass is running. Disabled by default.",
  ),
  anthropicApiKey: createGuidanceMessage(
    "Used by the Python LangGraph and Claude SDK backends.",
  ),
  anthropicModel: createGuidanceMessage(
    "Used by the Python LangGraph and Claude SDK backends.",
  ),
  maxRules: createGuidanceMessage(
    "Maximum number of rules returned by ",
    guidanceCode("/generate-rules"),
    ". The default is 5.",
  ),
  outputLanguage: createGuidanceMessage(
    "Sets the preferred language for supported AI-generated outputs, including title suggestions and cleanup suggestions. Individual jobs and prompts may override it; recipe generation does not currently use this global setting. Auto follows the source task when supported.",
  ),
} as const;
