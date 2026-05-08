import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatHHmm,
  formatHHmmss,
  formatOffset,
} from "./format-time.js";

describe("formatHHmmss", () => {
  it("zero-pads each component", () => {
    const t = new Date(2026, 0, 1, 3, 5, 9).getTime();
    expect(formatHHmmss(t)).toBe("03:05:09");
  });
});

describe("formatHHmm", () => {
  it("trims to hour:minute", () => {
    const t = new Date(2026, 0, 1, 14, 3, 0).getTime();
    expect(formatHHmm(t)).toBe("14:03");
  });
});

describe("formatOffset", () => {
  const base = 1_000_000_000;
  it.each<[number, string]>([
    [0, "+0s"],
    [6_000, "+6s"],
    [50_000, "+50s"],
    [60_000, "+1m 00s"],
    [333_000, "+5m 33s"],
    [3_600_000, "+1h 00m"],
    [8_640_000, "+2h 24m"],
  ])("renders offset of %d ms as %s", (delta, expected) => {
    expect(formatOffset(base + delta, base)).toBe(expected);
  });

  it("clamps negative offsets to +0s", () => {
    expect(formatOffset(base - 5_000, base)).toBe("+0s");
  });
});

describe("formatDuration", () => {
  it.each<[number, string]>([
    [0, "0s"],
    [12_000, "12s"],
    [60_000, "1m"],
    [125_000, "2m 5s"],
    [3_600_000, "1h"],
    [9_360_000, "2h 36m"],
  ])("renders %d ms as %s", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });

  it("returns 0s for negative input", () => {
    expect(formatDuration(-1)).toBe("0s");
  });
});
