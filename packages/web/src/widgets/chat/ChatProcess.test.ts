import { describe, expect, it } from "vitest";
import { extractProcessText } from "./ChatProcess.js";

describe("extractProcessText", () => {
  it("누적 transcript에서 최종 답변을 제외한 과정을 남긴다", () => {
    expect(extractProcessText("검색해볼게요.최종 답변입니다.", "최종 답변입니다.")).toBe(
      "검색해볼게요.",
    );
  });

  it("과정 없이 답변만 있으면 빈 문자열을 준다", () => {
    expect(extractProcessText("최종 답변", "최종 답변")).toBe("");
  });
});
