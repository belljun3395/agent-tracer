import { describe, expect, it } from "vitest";
import { readMetaNumber, readMetaNumberByKeys } from "./read-meta.js";

describe("readMetaNumber", () => {
  it("유한한 0 이상의 수를 읽는다", () => {
    expect(readMetaNumber(0)).toBe(0);
    expect(readMetaNumber(1200)).toBe(1200);
  });

  it("음수는 손상으로 보고 거른다", () => {
    expect(readMetaNumber(-1)).toBeNull();
  });

  it("수가 아니거나 유한하지 않으면 거른다", () => {
    expect(readMetaNumber("1200")).toBeNull();
    expect(readMetaNumber(Number.NaN)).toBeNull();
    expect(readMetaNumber(Number.POSITIVE_INFINITY)).toBeNull();
    expect(readMetaNumber(undefined)).toBeNull();
  });
});

describe("readMetaNumberByKeys", () => {
  it("먼저 맞는 키의 값을 쓴다", () => {
    expect(readMetaNumberByKeys({ b: 2, a: 1 }, ["a", "b"])).toBe(1);
  });

  it("앞선 키가 읽히지 않으면 다음 키로 넘어간다", () => {
    expect(readMetaNumberByKeys({ a: -1, b: 2 }, ["a", "b"])).toBe(2);
  });

  it("맞는 키가 없으면 null이다", () => {
    expect(readMetaNumberByKeys({ c: 3 }, ["a", "b"])).toBeNull();
  });
});
