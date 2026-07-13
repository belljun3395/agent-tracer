import { describe, expect, it } from "vitest";
import { DAEMON_HEALTH_STALE_THRESHOLD_MS, isDaemonHealthStale } from "~web/entities/daemon/model/daemon-health.js";

describe("isDaemonHealthStale", () => {
  it("임계값 이내면 stale이 아니다", () => {
    const now = Date.parse("2026-07-11T00:10:00.000Z");
    expect(isDaemonHealthStale("2026-07-11T00:05:00.000Z", now)).toBe(false);
  });

  it("임계값을 넘으면 stale이다", () => {
    const now = Date.parse("2026-07-11T00:00:00.000Z") + DAEMON_HEALTH_STALE_THRESHOLD_MS + 1;
    expect(isDaemonHealthStale("2026-07-11T00:00:00.000Z", now)).toBe(true);
  });

  it("보고 시각을 파싱할 수 없으면 stale로 본다", () => {
    expect(isDaemonHealthStale("not-a-date", Date.now())).toBe(true);
  });
});
