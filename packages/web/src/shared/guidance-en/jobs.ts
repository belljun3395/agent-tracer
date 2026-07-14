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
} as const;
