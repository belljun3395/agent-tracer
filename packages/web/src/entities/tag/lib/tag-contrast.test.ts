import { describe, expect, it } from "vitest";
import { readableForeground } from "~web/entities/tag/lib/tag-contrast.js";

describe("readableForeground", () => {
  it("검은 배경에는 흰색 전경을 고른다", () => {
    expect(readableForeground("#000000")).toBe("#ffffff");
  });

  it("흰 배경에는 검은 전경을 고른다", () => {
    expect(readableForeground("#ffffff")).toBe("#000000");
  });

  it("밝은 노랑 배경에는 검은 전경을 고른다", () => {
    expect(readableForeground("#fbca04")).toBe("#000000");
  });

  it("짙은 파랑 배경에는 흰색 전경을 고른다", () => {
    expect(readableForeground("#0052cc")).toBe("#ffffff");
  });

  it("태그 기본색(회색조)에는 흰색 전경을 고른다", () => {
    expect(readableForeground("#586069")).toBe("#ffffff");
  });

  it("대문자 hex도 소문자와 같은 판정을 낸다", () => {
    expect(readableForeground("#FBCA04")).toBe(readableForeground("#fbca04"));
  });

  it("잘못된 색 형식이면 검은 전경으로 안전하게 물러난다", () => {
    expect(readableForeground("not-a-color")).toBe("#000000");
    expect(readableForeground("#abc")).toBe("#000000");
  });
});
