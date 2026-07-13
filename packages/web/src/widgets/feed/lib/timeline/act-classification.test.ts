import { KIND } from "@monitor/kernel";
import { describe, expect, it } from "vitest";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import { classifyEvent } from "~web/widgets/feed/lib/timeline/act-classification.js";

describe("classifyEvent", () => {
  it("중간 어시스턴트 발화를 USER 카드 본문으로 만든다", () => {
    const event: TimelineEventRecord = {
      id: "event-1" as TimelineEventRecord["id"],
      taskId: "task-1" as TimelineEventRecord["taskId"],
      sessionId: "session-1" as NonNullable<TimelineEventRecord["sessionId"]>,
      kind: KIND.assistantCommentary,
      lane: "user",
      title: "진행 상황",
      body: "테스트를 실행하고 있습니다.",
      metadata: { phase: "commentary" },
      classification: { lane: "user", tags: [] },
      createdAt: "2026-07-10T00:00:01.000Z",
    };

    const vm = classifyEvent(event, Date.parse("2026-07-10T00:00:00.000Z"));

    expect(vm.lane.label).toBe("USER");
    expect(vm.bodyText).toBe("테스트를 실행하고 있습니다.");
  });
});
