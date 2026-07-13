import { describe, expect, it } from "vitest";
import { generateUlid } from "./ulid.js";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

describe("generateUlid", () => {
    it("26자, Crockford Base32 문자만으로 구성된다", () => {
        expect(generateUlid()).toMatch(ULID_PATTERN);
    });

    it("연속 호출은 서로 다른 값을 만든다", () => {
        const a = generateUlid();
        const b = generateUlid();
        expect(a).not.toBe(b);
    });

    it("더 늦은 시각으로 생성한 ULID가 사전순으로 더 뒤에 온다", () => {
        const earlier = generateUlid(1_000_000);
        const later = generateUlid(2_000_000);
        expect(earlier.slice(0, 10) < later.slice(0, 10)).toBe(true);
    });

    it("같은 시각이면 시간 부분(앞 10자)이 동일하다", () => {
        const a = generateUlid(1_700_000_000_000);
        const b = generateUlid(1_700_000_000_000);
        expect(a.slice(0, 10)).toBe(b.slice(0, 10));
    });
});
