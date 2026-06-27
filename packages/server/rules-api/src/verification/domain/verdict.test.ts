import { describe, expect, it } from "vitest";
import { aggregateVerdict } from "./verdict.js";

describe("aggregateVerdict — 턴 집계 판정", () => {
    it("가장 나쁜 판정을 고른다: contradicted > unverifiable > verified", () => {
        expect(aggregateVerdict(["verified", "contradicted", "unverifiable"])).toBe("contradicted");
        expect(aggregateVerdict(["verified", "unverifiable"])).toBe("unverifiable");
        expect(aggregateVerdict(["verified", "verified"])).toBe("verified");
    });

    it("인식 가능한 판정이 하나도 없으면 null", () => {
        expect(aggregateVerdict([])).toBeNull();
        expect(aggregateVerdict([null, undefined, "garbage"])).toBeNull();
    });

    it("알 수 없는 문자열/누락 값은 무시하고 유효한 것만 집계한다", () => {
        expect(aggregateVerdict(["unknown", null, "verified"])).toBe("verified");
        expect(aggregateVerdict(["", "contradicted", undefined])).toBe("contradicted");
    });
});
