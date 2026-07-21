import {describe, expect, it} from "vitest";
import {
    ANCHOR_TAG,
    buildAnchorBlock,
    buildAnchorDirective,
} from "~runtime/domain/rulegen/model/anchor.model.js";

describe("buildAnchorBlock", () => {
    it("앵커 입력을 다듬어 태그로 감싼다", () => {
        expect(buildAnchorBlock("  테스트 돌리고 커밋해  ")).toBe(
            `<${ANCHOR_TAG}>\n테스트 돌리고 커밋해\n</${ANCHOR_TAG}>\n`,
        );
    });

    it("앵커가 없거나 공백뿐이면 아무것도 싣지 않는다", () => {
        expect(buildAnchorBlock(undefined)).toBe("");
        expect(buildAnchorBlock("   ")).toBe("");
    });
});

describe("buildAnchorDirective", () => {
    it("앵커가 있으면 그 입력 하나만 검증하라고 못박는다", () => {
        const directive = buildAnchorDirective("테스트 돌려");

        expect(directive).toContain(`The <${ANCHOR_TAG}> is the ONE user request`);
        expect(directive).toContain("Propose one rule per distinct obligation");
        expect(directive).toContain("EMPTY rules array");
    });

    it("앵커가 없거나 공백뿐이면 지침을 남기지 않는다", () => {
        expect(buildAnchorDirective(undefined)).toBe("");
        expect(buildAnchorDirective("   ")).toBe("");
    });
});
