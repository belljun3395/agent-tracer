import {
  createGuidanceMessage,
} from "~web/shared/guidance-message.js";

export const EN_JOBS = {
  introduction: createGuidanceMessage(
    "Newest first. Review execution results and diagnostic history.",
  ),
  resetFilters: createGuidanceMessage(
    "Reset the filters to see the complete history.",
  ),
  cancel: createGuidanceMessage(
    "The active agent call stops immediately. This cannot be undone.",
  ),
  trajectoryIntroduction: createGuidanceMessage(
    "Execution steps recorded while the agent produced the result.",
  ),
  trajectoryAttempt: createGuidanceMessage("Attempt"),
  rawDataIntroduction: createGuidanceMessage(
    "Server data for reproduction and diagnostics. Use Overview for normal result review.",
  ),
  noTargetTask: createGuidanceMessage(
    "The suggestion cannot be applied because this job has no target task.",
  ),
  noTitleSuggestions: createGuidanceMessage(
    "This job did not produce a title suggestion that can be applied.",
  ),
  loadingCleanupSuggestions: createGuidanceMessage(
    "Loading cleanup suggestions…",
  ),
  noCleanupSuggestions: createGuidanceMessage(
    "This job did not produce any cleanup suggestions.",
  ),
  trajectoryAfterCompletion: createGuidanceMessage(
    "The trajectory appears after the job finishes.",
  ),
  loadingTrajectory: createGuidanceMessage("Loading trajectory…"),
  trajectoryUnavailable: createGuidanceMessage(
    "The trajectory could not be loaded.",
  ),
  noTrajectory: createGuidanceMessage(
    "No trajectory was recorded for this job.",
  ),
  feedback: {
    result: {
      prompt: createGuidanceMessage("How was this result?"),
      detail: createGuidanceMessage(
        "Your rating improves generation quality and does not change the result itself.",
      ),
    },
    title: {
      prompt: createGuidanceMessage("How was this title suggestion?"),
      detail: createGuidanceMessage(
        "Your rating improves title generation and does not change the title itself.",
      ),
    },
    rule: {
      prompt: createGuidanceMessage("How was this rule suggestion?"),
      detail: createGuidanceMessage(
        "Your rating improves rule generation and does not change the rule itself.",
      ),
    },
    recipe: {
      prompt: createGuidanceMessage("How was this recipe suggestion?"),
      detail: createGuidanceMessage(
        "Your rating improves recipe generation and does not change the recipe itself.",
      ),
    },
    saveHint: createGuidanceMessage("Select usefulness or quality, then save."),
    saved: createGuidanceMessage("Your rating was saved. Thank you."),
    readyToSave: createGuidanceMessage("Select Save to record this rating."),
  },
} as const;
