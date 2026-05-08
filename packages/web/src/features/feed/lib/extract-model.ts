import type { TimelineEventRecord } from "~domain/monitoring.js";

const MODEL_KEYS = ["model", "modelName", "model_name", "ai_model", "aiModel"];

/**
 * Pick the most recent model identifier observed in the timeline. Walks
 * backwards so a session that switched models mid-run shows the latest.
 *
 * Server doesn't denormalise model onto the task — runs that span
 * multiple sessions could touch multiple models, so we take "the model
 * that produced the most recent assistant turn" as the displayed value.
 */
export function extractLatestModel(
  events: readonly TimelineEventRecord[],
): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const meta = events[i]!.metadata;
    for (const key of MODEL_KEYS) {
      const value = meta[key];
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }
  }
  return null;
}
