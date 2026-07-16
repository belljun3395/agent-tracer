import {describe, expect, it} from "vitest";
import {ellipsize, toBoolean, toTrimmedString, truncate, truncateOutput} from "~runtime/support/text.js";

/** 코드유닛을 순회해 외톨이 서로게이트가 없는지 확인한다. */
function hasLoneSurrogate(value: string): boolean {
    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        const isHigh = code >= 0xd800 && code <= 0xdbff;
        const isLow = code >= 0xdc00 && code <= 0xdfff;
        if (isHigh) {
            const next = value.charCodeAt(i + 1);
            if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
            i++;
        } else if (isLow) {
            return true;
        }
    }
    return false;
}

describe("truncate", () => {
    it("maxLength가 0 이하이면 빈 문자열을 반환한다", () => {
        expect(truncate("abc", 0)).toBe("");
        expect(truncate("abc", -1)).toBe("");
    });

    it("maxLength가 원본 길이 이상이면 원본을 그대로 반환한다", () => {
        expect(truncate("abc", 3)).toBe("abc");
        expect(truncate("abc", 10)).toBe("abc");
    });

    it("서로게이트 페어 중간에서 잘리면 반쪽 high surrogate를 제거한다", () => {
        // "a😀"는 length 3 (a=1, 이모지 서로게이트 페어=2), maxLength 2는 high surrogate만 남긴다.
        const result = truncate("a😀", 2);
        expect(result).toBe("a");
        expect(hasLoneSurrogate(result)).toBe(false);
    });

    it("서로게이트 페어가 온전히 들어가면 그대로 유지한다", () => {
        const result = truncate("a😀", 3);
        expect(result).toBe("a😀");
        expect(hasLoneSurrogate(result)).toBe(false);
    });
});

describe("ellipsize", () => {
    it("길이가 maxLength 이하이면 원본을 그대로 반환한다", () => {
        expect(ellipsize("abc", 3)).toBe("abc");
        expect(ellipsize("abc", 10)).toBe("abc");
    });

    it("길면 maxLength-1까지 자르고 말줄임표를 붙인다", () => {
        expect(ellipsize("abcdef", 4)).toBe("abc…");
    });

    it("maxLength가 1 이하이면 truncate로 폴백해 말줄임표를 붙이지 않는다", () => {
        expect(ellipsize("abcdef", 1)).toBe("a");
        expect(ellipsize("abcdef", 0)).toBe("");
    });

    it("정확히 maxLength 길이인 경계값에서는 말줄임표가 붙지 않는다", () => {
        const value = "abcd";
        expect(ellipsize(value, 4)).toBe("abcd");
        expect(ellipsize(value, 4)).not.toContain("…");
    });
});

describe("truncateOutput", () => {
    it("짧은 텍스트는 자르지 않고 원본 바이트 수를 담는다", () => {
        const text = "hello world";
        const result = truncateOutput(text, 100, 100);

        expect(result.truncated).toBe(false);
        expect(result.body).toBe(text);
        expect(result.bytes).toBe(Buffer.byteLength(text, "utf8"));
    });

    it("긴 텍스트는 head/tail을 남기고 생략 마커에 정확한 생략 글자 수를 표시한다", () => {
        const text = "0123456789".repeat(10); // length 100
        const result = truncateOutput(text, 5, 5);

        expect(result.truncated).toBe(true);
        expect(result.body.startsWith("01234")).toBe(true);
        expect(result.body.endsWith("56789")).toBe(true);
        expect(result.body).toContain("…[90 chars omitted]…");
        expect(result.bytes).toBe(Buffer.byteLength(text, "utf8"));
    });

    it("자르기 전 전체 바이트 수를 반환하며 잘린 body의 바이트 수와는 다르다", () => {
        const text = "가".repeat(50); // 한글 한 글자 = utf8 3바이트
        const result = truncateOutput(text, 5, 5);

        expect(result.bytes).toBe(150);
        expect(Buffer.byteLength(result.body, "utf8")).toBeLessThan(result.bytes);
    });

    it("멀티바이트 문자에서 bytes는 문자 수가 아니라 UTF-8 바이트 수다", () => {
        const text = "한글텍스트";
        const result = truncateOutput(text, 100, 100);

        expect(result.truncated).toBe(false);
        expect(text.length).toBe(5);
        expect(result.bytes).toBe(15);
    });

    it("head 끝과 tail 시작에 이모지를 배치해도 서로게이트를 쪼개지 않는다", () => {
        // head가 끝나는 지점과 tail이 시작하는 지점에 각각 서로게이트 페어를 걸치도록 구성한다.
        const filler = "x".repeat(20);
        const text = `${filler}😀${filler}😀${filler}`;
        const result = truncateOutput(text, 21, 21);

        expect(result.truncated).toBe(true);
        expect(hasLoneSurrogate(result.body)).toBe(false);
    });

    it("tail이 low surrogate로 시작하면 truncateStart가 그 앞쪽 한 유닛을 제거한다", () => {
        // 이모지 바로 뒤부터 tailChars만큼 자르면 low surrogate만 남는 경계를 만든다.
        const text = `${"a".repeat(30)}😀${"b".repeat(30)}`;
        const result = truncateOutput(text, 5, 31);

        expect(result.truncated).toBe(true);
        expect(hasLoneSurrogate(result.body)).toBe(false);
        // low surrogate가 제거됐으므로 tail은 이모지를 포함하지 않고 b로만 시작한다.
        expect(result.body.endsWith("b".repeat(30))).toBe(true);
    });
});

describe("toBoolean", () => {
    it("boolean 값은 그대로 반환한다", () => {
        expect(toBoolean(true)).toBe(true);
        expect(toBoolean(false)).toBe(false);
    });

    it("number는 0이면 false, 그 외에는 true다", () => {
        expect(toBoolean(0)).toBe(false);
        expect(toBoolean(1)).toBe(true);
        expect(toBoolean(-1)).toBe(true);
        expect(toBoolean(0.0)).toBe(false);
    });

    it("문자열 true/1/yes만 대소문자 무관하게 참이다", () => {
        expect(toBoolean("true")).toBe(true);
        expect(toBoolean("TRUE")).toBe(true);
        expect(toBoolean("True")).toBe(true);
        expect(toBoolean("1")).toBe(true);
        expect(toBoolean("yes")).toBe(true);
        expect(toBoolean("YES")).toBe(true);
    });

    it("그 외 문자열은 거짓이다", () => {
        expect(toBoolean("false")).toBe(false);
        expect(toBoolean("no")).toBe(false);
        expect(toBoolean("")).toBe(false);
        expect(toBoolean("random")).toBe(false);
        expect(toBoolean("2")).toBe(false);
    });

    it("문자열도 숫자도 아닌 값은 거짓이다", () => {
        expect(toBoolean(undefined)).toBe(false);
        expect(toBoolean(null)).toBe(false);
        expect(toBoolean({})).toBe(false);
        expect(toBoolean([])).toBe(false);
    });
});

describe("toTrimmedString", () => {
    it("문자열은 앞뒤 공백만 제거한다", () => {
        expect(toTrimmedString("  hello  ")).toBe("hello");
    });

    it("number/boolean/bigint는 문자열로 변환 후 trim한다", () => {
        expect(toTrimmedString(42)).toBe("42");
        expect(toTrimmedString(true)).toBe("true");
        expect(toTrimmedString(false)).toBe("false");
        expect(toTrimmedString(10n)).toBe("10");
    });

    it("그 외 타입은 빈 문자열이다", () => {
        expect(toTrimmedString(undefined)).toBe("");
        expect(toTrimmedString(null)).toBe("");
        expect(toTrimmedString({})).toBe("");
        expect(toTrimmedString([])).toBe("");
    });

    it("maxLength를 주면 truncate가 적용된다", () => {
        expect(toTrimmedString("  hello world  ", 5)).toBe("hello");
    });

    it("maxLength가 없으면 길이 제한 없이 반환한다", () => {
        expect(toTrimmedString("  hello world  ")).toBe("hello world");
    });
});
