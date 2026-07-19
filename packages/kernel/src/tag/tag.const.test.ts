import { describe, expect, it } from "vitest";
import {
    TAG_COLOR_PALETTE,
    TAG_COLOR_PATTERN,
    TAG_DEFAULT_COLOR,
} from "./tag.const.js";

describe("tag 계약 어휘", () => {
    it("기본 팔레트의 모든 색이 저장 형식을 지킨다", () => {
        for (const color of TAG_COLOR_PALETTE) {
            expect(TAG_COLOR_PATTERN.test(color)).toBe(true);
        }
    });

    it("기본 색이 팔레트 안에 있다", () => {
        expect(TAG_COLOR_PALETTE).toContain(TAG_DEFAULT_COLOR);
    });

    it("팔레트에 같은 색이 두 번 들어가지 않는다", () => {
        expect(new Set(TAG_COLOR_PALETTE).size).toBe(TAG_COLOR_PALETTE.length);
    });
});
