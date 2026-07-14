import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildTitleContext, type TitleTurn } from "./title.context.model.js";

// 실행 백엔드가 이 모양 그대로 받아 파싱하므로 골든 픽스처가 두 언어의 계약을 한 파일로 묶는다.
const GOLDEN = new URL(
    "../../../../../../../kernel/src/agent/__fixtures__/title.suggestion.context.json",
    import.meta.url,
);

function turn(turnIndex: number, askedText: string, assistantText: string | null): TitleTurn {
    return { turnIndex, askedText, assistantText };
}

describe("buildTitleContext", () => {
    it("실행 백엔드와 공유하는 컨텍스트 계약 픽스처와 같은 모양을 낸다", () => {
        const golden = JSON.parse(readFileSync(GOLDEN, "utf8")) as Record<string, unknown>;

        const context = buildTitleContext(
            { title: "Untitled", status: "completed", workspacePath: "/repo" },
            [
                turn(1, "인증 토큰 누수를 고쳐줘", "누수를 수정하고 회귀 테스트를 추가했습니다."),
                turn(3, "회귀 테스트도 추가해줘", null),
            ],
            42,
        );

        expect(JSON.parse(JSON.stringify({ ...context, totalTurnCount: 3, truncated: true }))).toEqual(golden);
    });

    it("턴 창을 넘기면 첫 턴을 남기고 잘라내며 잘렸음을 알린다", () => {
        const turns = Array.from({ length: 25 }, (_, index) => turn(index + 1, `요청 ${index + 1}`, null));

        const context = buildTitleContext({ title: "t", status: "running" }, turns, 100);

        expect(context.truncated).toBe(true);
        expect(context.totalTurnCount).toBe(25);
        expect(context.turns[0]?.turnIndex).toBe(1);
        expect(context.turns.at(-1)?.turnIndex).toBe(25);
    });
});
