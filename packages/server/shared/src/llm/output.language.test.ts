import { describe, expect, it } from "vitest";
import { normalizeOutputLanguage } from "./output.language.js";

describe("normalizeOutputLanguage — LLM 출력 언어 정규화", () => {
    it("지원 언어는 소문자로 정규화한다", () => {
        expect(normalizeOutputLanguage("KO")).toBe("ko");
        expect(normalizeOutputLanguage(" ja ")).toBe("ja");
    });

    it("미지원/빈 값은 auto로 되돌린다", () => {
        expect(normalizeOutputLanguage("fr")).toBe("auto");
        expect(normalizeOutputLanguage("")).toBe("auto");
        expect(normalizeOutputLanguage(null)).toBe("auto");
    });
});
