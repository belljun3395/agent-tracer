import { describe, expect, it } from "vitest";
import { selectFinalChatText } from "./chat.response.js";

describe("selectFinalChatText", () => {
    it("도구 탐색 설명을 제외하고 마지막 답변 step만 고른다", () => {
        expect(
            selectFinalChatText(
                [
                    { role: "assistant", content: "태스크를 검색해볼게요.", toolCalls: [{ id: "call-1" }] },
                    { role: "tool", content: "검색 결과", toolCalls: [] },
                    { role: "assistant", content: "가장 오래된 태스크는 A입니다.", toolCalls: [] },
                ],
                "태스크를 검색해볼게요.가장 오래된 태스크는 A입니다.",
            ),
        ).toBe("가장 오래된 태스크는 A입니다.");
    });

    it("구조적 최종 step이 없으면 원래 출력을 유지한다", () => {
        expect(
            selectFinalChatText(
                [{ role: "assistant", content: "검색 중", toolCalls: [{ id: "call-1" }] }],
                "검색 중",
            ),
        ).toBe("검색 중");
    });
});
