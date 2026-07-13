import { describe, expect, it } from "vitest";
import { matchesPhrase, normalizeMatchText, stemToken } from "./rule.trigger.match.js";

describe("normalizeMatchText", () => {
    it("구두점과 연속 공백을 지우고 소문자로 접는다", () => {
        expect(normalizeMatchText("  npm  run   TEST!! ")).toBe("npm run test");
    });

    it("한글은 음절 그대로 남긴다", () => {
        expect(normalizeMatchText("테스트를, 실행해줘.")).toBe("테스트를 실행해줘");
    });

    it("호환 유니코드 문자를 같은 표면형으로 접는다", () => {
        expect(normalizeMatchText("ＮＰＭ　ＲＵＮ　ＴＥＳＴ")).toBe("npm run test");
    });
});

describe("matchesPhrase", () => {
    it("정확히 들어 있는 문구를 매치한다", () => {
        expect(matchesPhrase("run the tests", "please run the tests now", false)).toBe(true);
    });

    it("조사와 어미가 달라진 한글 요구를 매치한다", () => {
        expect(matchesPhrase("테스트 실행해줘", "그리고 테스트를 실행하고 결과를 알려줘", false)).toBe(true);
    });

    it("한글 어간이 모두 있으면 등장 순서가 달라도 매치한다", () => {
        expect(matchesPhrase("테스트 실행해줘", "실행하고 테스트 결과를 알려줘", false)).toBe(true);
    });

    it("구두점과 띄어쓰기만 다른 한글 문구를 매치한다", () => {
        expect(matchesPhrase("린트 돌려줘", "린트  돌려줘!", false)).toBe(true);
    });

    it("겹치지 않는 한글 요구는 매치하지 않는다", () => {
        expect(matchesPhrase("테스트 실행해줘", "문서를 새로 써줘", false)).toBe(false);
    });

    it("짧은 영어 문구를 근사 매치로 확대하지 않는다", () => {
        expect(matchesPhrase("run tests", "running a test", false)).toBe(false);
    });

    it("영어 부정문 안의 언급은 트리거로 치지 않는다", () => {
        expect(matchesPhrase("run the tests", "I did not run the tests", true)).toBe(false);
    });

    it("한글은 문구 뒤에 오는 부정을 본다", () => {
        expect(matchesPhrase("테스트 실행", "테스트 실행하지 마세요", true)).toBe(false);
    });

    it("부정을 보지 않는 모드에서는 부정문도 매치한다", () => {
        expect(matchesPhrase("테스트 실행", "테스트 실행하지 마세요", false)).toBe(true);
    });
});

describe("stemToken", () => {
    it("조사를 벗긴다", () => {
        expect(stemToken("테스트를")).toBe("테스트");
    });

    it("어미를 벗긴다", () => {
        expect(stemToken("실행해줘")).toBe("실행");
        expect(stemToken("실행해주세요")).toBe("실행");
        expect(stemToken("실행하고")).toBe("실행");
    });

    it("어간이 한 글자로 줄어드는 절단은 하지 않는다", () => {
        expect(stemToken("커밋")).toBe("커밋");
    });
});
