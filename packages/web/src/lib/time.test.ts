import { describe, expect, it } from "vitest";
import { formatRelativeShort } from "./time.js";

describe("formatRelativeShort", () => {
  const NOW = 1_000_000_000_000; // arbitrary anchor

  it.each([
    [NOW - 0, "just now"],
    [NOW - 5_000, "just now"],
    [NOW - 29_999, "just now"],
    [NOW - 30_000, "30s"],
    [NOW - 59_999, "59s"],
    [NOW - 60_000, "1m"],
    [NOW - 5 * 60_000, "5m"],
    [NOW - 60 * 60_000, "1h"],
    [NOW - 23 * 60 * 60_000, "23h"],
    [NOW - 24 * 60 * 60_000, "1d"],
    [NOW - 6 * 24 * 60 * 60_000, "6d"],
    [NOW - 7 * 24 * 60 * 60_000, "1w"],
    [NOW - 27 * 24 * 60 * 60_000, "3w"],
    [NOW - 31 * 24 * 60 * 60_000, "1mo"],
  ])("formats delta from %i correctly as %s", (ts, expected) => {
    expect(formatRelativeShort(ts, NOW)).toBe(expected);
  });

  it("accepts ISO strings", () => {
    const iso = new Date(NOW - 5 * 60_000).toISOString();
    expect(formatRelativeShort(iso, NOW)).toBe("5m");
  });

  it("accepts Date instances", () => {
    expect(formatRelativeShort(new Date(NOW - 60_000), NOW)).toBe("1m");
  });
});
