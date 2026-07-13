import { describe, expect, test } from "vitest";
import { timeBucketKey } from "~web/widgets/task-list/lib/group-tasks.js";

const NOW = Date.parse("2026-06-15T12:00:00.000Z");

describe("timeBucketKey", () => {
  test("오늘 안의 시각은 today로 센다", () => {
    expect(timeBucketKey(Date.parse("2026-06-15T09:00:00.000Z"), NOW)).toBe("today");
  });

  test("어제 범위의 시각은 yesterday로 센다", () => {
    expect(timeBucketKey(Date.parse("2026-06-14T09:00:00.000Z"), NOW)).toBe("yesterday");
  });

  test("그보다 이전 시각은 older로 센다", () => {
    expect(timeBucketKey(Date.parse("2026-06-01T09:00:00.000Z"), NOW)).toBe("older");
  });

  test("정확히 오늘 시작 경계는 yesterday가 아닌 today로 센다", () => {
    const startOfToday = new Date(NOW);
    startOfToday.setHours(0, 0, 0, 0);
    expect(timeBucketKey(startOfToday.getTime(), NOW)).toBe("today");
  });
});
