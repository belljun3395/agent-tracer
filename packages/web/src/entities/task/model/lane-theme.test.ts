import { KIND } from "@monitor/kernel";
import { describe, expect, it } from "vitest";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import { laneThemeFor, laneThemeForEvent } from "~web/entities/task/model/lane-theme.js";

describe("타임라인 레인 테마", () => {
  it("서버 레인을 화면 레인과 테마 토큰으로 매핑한다", () => {
    expect(laneThemeFor("exploration")).toEqual({
      key: "expl",
      label: "EXPL",
      cssColor: "var(--ph-expl)",
    });
    expect(laneThemeFor("questions").key).toBe("rule");
  });

  it("어시스턴트 레인을 사용자 레인과 다른 화면 레인으로 가른다", () => {
    expect(laneThemeFor("assistant")).toEqual({
      key: "asst",
      label: "ASST",
      cssColor: "var(--ph-asst)",
    });
    expect(laneThemeFor("user").key).toBe("user");
  });

  it("검증 이벤트는 원래 레인보다 검증 레인을 우선한다", () => {
    const event = {
      kind: KIND.verificationLogged,
      lane: "implementation",
    } as TimelineEventRecord;

    expect(laneThemeForEvent(event).key).toBe("veri");
  });
});
