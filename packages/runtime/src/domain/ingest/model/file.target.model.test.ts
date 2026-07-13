import {describe, expect, it} from "vitest";
import {analyzeCommand} from "~runtime/domain/ingest/model/command.semantic.model.js";
import {
    MAX_FILE_TARGETS,
    MAX_FILE_TARGET_LENGTH,
    collectFileTargets,
    toOptionalNumber,
} from "~runtime/domain/ingest/model/file.target.model.js";

describe("collectFileTargets", () => {
    it("중첩 파이프라인의 파일 경로를 중복 없이 모은다", () => {
        const analysis = analyzeCommand("cat a.ts b.ts | grep foo c.ts");

        expect(collectFileTargets(analysis)).toEqual(["a.ts", "b.ts", "c.ts"]);
    });

    it("파일 경로가 100개를 넘으면 100개에서 자른다", () => {
        const files = Array.from({length: 150}, (_, index) => `f${index}.ts`);

        expect(collectFileTargets(analyzeCommand(`cat ${files.join(" ")}`))).toHaveLength(MAX_FILE_TARGETS);
    });

    it("1024자를 넘는 경로는 버린다", () => {
        const longPath = `${"a".repeat(MAX_FILE_TARGET_LENGTH)}.ts`;

        expect(collectFileTargets(analyzeCommand(`cat ok.ts ${longPath}`))).toEqual(["ok.ts"]);
    });
});

describe("toOptionalNumber", () => {
    it("숫자 문자열을 숫자로 읽고 그 밖은 버린다", () => {
        expect(toOptionalNumber("12")).toBe(12);
        expect(toOptionalNumber(12)).toBe(12);
        expect(toOptionalNumber("열둘")).toBeUndefined();
        expect(toOptionalNumber(null)).toBeUndefined();
    });
});
