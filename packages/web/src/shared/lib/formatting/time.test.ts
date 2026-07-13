import { describe, expect, test } from "vitest";
import {
  formatAbsoluteHHmmss,
  formatDuration,
  formatHHmm,
  formatHHmmss,
  formatOffset,
  formatRelativeShort,
} from "~web/shared/lib/formatting/time.js";

describe("formatRelativeShort", () => {
  const now = Date.parse("2026-06-15T12:00:00.000Z");

  test("30초 미만이면 'just now'를 보여준다", () => {
    expect(formatRelativeShort(now - 10_000, now)).toBe("just now");
  });

  test("30초~59초는 초 단위로 표시한다", () => {
    expect(formatRelativeShort(now - 45_000, now)).toBe("45s");
  });

  test("분 단위로 표시한다", () => {
    expect(formatRelativeShort(now - 5 * 60_000, now)).toBe("5m");
  });

  test("시간 단위로 표시한다", () => {
    expect(formatRelativeShort(now - 3 * 3_600_000, now)).toBe("3h");
  });

  test("일 단위로 표시한다", () => {
    expect(formatRelativeShort(now - 2 * 86_400_000, now)).toBe("2d");
  });

  test("주 단위로 표시한다", () => {
    expect(formatRelativeShort(now - 10 * 86_400_000, now)).toBe("1w");
  });

  test("4주 이상이면 개월 단위로 표시한다", () => {
    expect(formatRelativeShort(now - 40 * 86_400_000, now)).toBe("1mo");
  });

  test("epoch ms뿐 아니라 ISO 문자열 입력도 받는다", () => {
    expect(formatRelativeShort("2026-06-15T11:55:00.000Z", now)).toBe("5m");
  });

  test("Date 입력도 받는다", () => {
    expect(formatRelativeShort(new Date(now - 5 * 60_000), now)).toBe("5m");
  });
});

describe("formatAbsoluteHHmmss", () => {
  test("로컬 YYYY-MM-DD HH:MM:SS 형식으로 포맷한다", () => {
    const ms = Date.parse("2026-06-15T12:34:56.000Z");
    const d = new Date(ms);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const expected = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    expect(formatAbsoluteHHmmss(ms)).toBe(expected);
  });

  test("잘못된 입력은 'NaN-NaN-NaN' 대신 빈 문자열을 반환한다", () => {
    expect(formatAbsoluteHHmmss("not-a-date")).toBe("");
  });
});

describe("formatDuration", () => {
  test("분 단위 미만은 초로 적는다", () => {
    expect(formatDuration(9000)).toBe("9s");
  });

  test("분과 초를 함께 적는다", () => {
    expect(formatDuration(125_000)).toBe("2m 5s");
  });

  test("음수 경과 시간은 0초로 정규화한다", () => {
    expect(formatDuration(-1)).toBe("0s");
  });
});

describe("타임라인 시각 포맷", () => {
  test("로컬 시각을 분과 초 단위로 표시한다", () => {
    const instant = new Date(2026, 6, 13, 14, 3, 8);

    expect(formatHHmm(instant)).toBe("14:03");
    expect(formatHHmmss(instant)).toBe("14:03:08");
  });

  test("기준 시각부터의 경과를 가장 작은 읽기 단위로 표시한다", () => {
    expect(formatOffset(5_000, 0)).toBe("+5s");
    expect(formatOffset(333_000, 0)).toBe("+5m 33s");
    expect(formatOffset(8_640_000, 0)).toBe("+2h 24m");
  });

  test("기준보다 이른 시각은 0초로 정규화한다", () => {
    expect(formatOffset(0, 5_000)).toBe("+0s");
  });
});
