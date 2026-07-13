import { KIND } from "@monitor/kernel";
import { describe, expect, it } from "vitest";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import { EventId, TaskId } from "~web/shared/identity.js";
import { extractContextSnapshot } from "~web/widgets/feed/lib/extraction/extract-context.js";

describe("extractContextSnapshot", () => {
  it("Codex token.usage의 canonical metadata로 컨텍스트 사용률을 계산한다", () => {
    const snapshot = extractContextSnapshot([event({
      contextWindowTotalTokens: 25_573,
      contextWindowSize: 353_400,
    })]);

    expect(snapshot).toMatchObject({
      used: 25_573,
      limit: 353_400,
      percent: 7,
    });
  });
});

function event(metadata: Record<string, unknown>): TimelineEventRecord {
  return {
    id: EventId("event-1"),
    taskId: TaskId("task-1"),
    kind: KIND.tokenUsage,
    lane: "telemetry",
    title: "Token usage",
    metadata,
    classification: { lane: "telemetry", tags: [] },
    createdAt: "2026-07-10T00:00:00.000Z",
  };
}
