import {describe, expect, it} from "vitest";
import {
    buildIntentBlock,
    buildIntentDirective,
    INTENT_TAG,
} from "~runtime/domain/rulegen/model/intent.model.js";

describe("buildIntentBlock", () => {
    it("의도를 데이터 태그로 감싸 싣는다", () => {
        expect(buildIntentBlock("린트를 돌렸는지 확인")).toBe(
            `\n<${INTENT_TAG}>\n린트를 돌렸는지 확인\n</${INTENT_TAG}>\n`,
        );
    });

    it("의도가 없으면 아무것도 싣지 않는다", () => {
        expect(buildIntentBlock(undefined)).toBe("");
    });
});

describe("buildIntentDirective", () => {
    it("의도를 지침이 아니라 조향용 비신뢰 데이터로 다루라고 못박는다", () => {
        const directive = buildIntentDirective("린트 확인");

        expect(directive).toContain("Operator intent:");
        expect(directive).toContain("UNTRUSTED DATA");
        expect(directive).toContain(`<${INTENT_TAG}>`);
    });

    it("의도가 없으면 지침을 남기지 않는다", () => {
        expect(buildIntentDirective(undefined)).toBe("");
    });
});
