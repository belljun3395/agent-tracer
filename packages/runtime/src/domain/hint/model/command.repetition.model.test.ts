import {describe, expect, it} from "vitest";
import {detectCommandRepetition} from "~runtime/domain/hint/model/command.repetition.model.js";

const NOW = Date.parse("2026-07-16T00:00:00.000Z");

describe("detectCommandRepetition", () => {
    it("명령 분석이 파괴적으로 본 명령에 경고를 낸다", () => {
        const hints = detectCommandRepetition([], "rm -rf build", NOW);
        expect(hints.some((hint) => hint.type === "destructive_risk")).toBe(true);
    });

    it("정규식이 아니라 분석 effect를 쓰므로 강제 push도 파괴적으로 본다", () => {
        const hints = detectCommandRepetition([], "git push --force origin main", NOW);
        expect(hints.some((hint) => hint.type === "destructive_risk")).toBe(true);
    });

    it("파괴적이지 않은 명령에는 경고를 내지 않는다", () => {
        const hints = detectCommandRepetition([], "ls -al", NOW);
        expect(hints.some((hint) => hint.type === "destructive_risk")).toBe(false);
    });
});
