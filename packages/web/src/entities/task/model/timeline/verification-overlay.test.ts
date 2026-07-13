import { KIND } from "@monitor/kernel";
import { describe, expect, it } from "vitest";
import type { EventId } from "~web/shared/identity.js";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import type { TaskVerification } from "~web/entities/task/model/timeline/verification.js";
import { buildVerificationOverlay } from "~web/entities/task/model/timeline/verification-overlay.js";

function event(
  id: string,
  turnId: string,
  kind: TimelineEventRecord["kind"] = KIND.actionLogged,
  createdAt = "2026-07-10T09:00:00.000Z",
): TimelineEventRecord {
  return {
    id: id as EventId,
    taskId: "task-1" as TimelineEventRecord["taskId"],
    turnId,
    kind,
    lane: "implementation",
    title: id,
    metadata: {},
    classification: { lane: "implementation", tags: [] },
    createdAt,
  };
}

function verification(
  id: string,
  ruleId: string,
  turnId: string,
  matchedEventIds: readonly string[],
  triggerEventId?: string,
): TaskVerification {
  return {
    id,
    taskId: "task-1",
    ruleId,
    ruleName: `규칙 ${ruleId}`,
    turnId,
    evaluatedAt: "2026-07-10T09:05:00.000Z",
    ...(triggerEventId !== undefined ? { triggerEventId } : {}),
    matchedEventIds,
  };
}

describe("buildVerificationOverlay", () => {
  it("매칭된 모든 원본 이벤트를 VERI 레인 이동 대상으로 표시한다", () => {
    const events = [event("event-a", "turn-1"), event("event-b", "turn-1")];
    const verified = verification("verification-1", "rule-1", "turn-1", ["event-a", "event-b"]);

    const overlay = buildVerificationOverlay(events, [verified]);

    expect(overlay.get("event-a")).toEqual({ moveToVeri: true, verifications: [verified] });
    expect(overlay.get("event-b")).toEqual({ moveToVeri: true, verifications: [verified] });
    expect(events.map((item) => item.lane)).toEqual(["implementation", "implementation"]);
  });

  it("한 이벤트의 여러 규칙을 모으고 같은 검증은 중복하지 않는다", () => {
    const first = verification("verification-1", "rule-1", "turn-1", ["event-a"]);
    const second = verification("verification-2", "rule-2", "turn-1", ["event-a"]);
    const overlay = buildVerificationOverlay([event("event-a", "turn-1")], [first, second, first]);

    expect(overlay.get("event-a")).toEqual({
      moveToVeri: true,
      verifications: [first, second],
    });
  });

  it("매칭 이벤트가 없는 검증은 트리거에 배지만 붙이고 레인은 옮기지 않는다", () => {
    const verified = verification("verification-1", "rule-1", "turn-1", [], "event-trigger");
    const overlay = buildVerificationOverlay([event("event-trigger", "turn-1")], [verified]);

    expect(overlay.get("event-trigger")).toEqual({
      moveToVeri: false,
      verifications: [verified],
    });
  });

  it("트리거가 없거나 찾을 수 없으면 같은 턴의 마지막 응답에 배지를 붙인다", () => {
    const early = event("response-early", "turn-1", KIND.assistantResponse, "2026-07-10T09:01:00.000Z");
    const late = event("response-late", "turn-1", KIND.assistantResponse, "2026-07-10T09:02:00.000Z");
    const otherTurn = event("response-other", "turn-2", KIND.assistantResponse, "2026-07-10T09:03:00.000Z");
    const withoutTrigger = verification("verification-1", "rule-1", "turn-1", []);
    const unresolvedTrigger = verification("verification-2", "rule-2", "turn-1", [], "missing-trigger");
    const overlay = buildVerificationOverlay(
      [late, otherTurn, early],
      [withoutTrigger, unresolvedTrigger],
    );

    expect(overlay.get("response-late")).toEqual({
      moveToVeri: false,
      verifications: [withoutTrigger, unresolvedTrigger],
    });
    expect(overlay.has("response-early")).toBe(false);
    expect(overlay.has("response-other")).toBe(false);
  });

  it("존재하지 않는 매칭 이벤트 ID는 무시한다", () => {
    const partiallyKnown = verification(
      "verification-1",
      "rule-1",
      "turn-1",
      ["event-known", "event-unknown"],
    );
    const unknownOnly = verification("verification-2", "rule-2", "turn-1", ["missing-event"]);
    const overlay = buildVerificationOverlay(
      [event("event-known", "turn-1")],
      [partiallyKnown, unknownOnly],
    );

    expect([...overlay.keys()]).toEqual(["event-known"]);
    expect(overlay.get("event-known")?.verifications).toEqual([partiallyKnown]);
  });
});
