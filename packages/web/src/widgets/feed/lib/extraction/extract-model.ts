import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";

const MODEL_KEYS = ["model", "modelName", "model_name", "ai_model", "aiModel"];

/** 타임라인에서 관측된 가장 최근 모델 식별자를 고른다. */
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
