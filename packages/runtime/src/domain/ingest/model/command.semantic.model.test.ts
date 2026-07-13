import {describe, expect, it} from "vitest";
import {analyzeCommand, inferCommandSemantic} from "~runtime/domain/ingest/model/command.semantic.model.js";

describe("analyzeCommand", () => {
    it("단순 읽기 명령을 read_only로 분류한다", () => {
        const analysis = analyzeCommand("cat package.json");

        expect(analysis.structure).toBe("simple");
        expect(analysis.overallEffect).toBe("read_only");
        expect(analysis.steps[0]?.commandName).toBe("cat");
    });

    it("따옴표 안의 연산자는 시퀀스로 가르지 않는다", () => {
        expect(analyzeCommand('git commit -m "fix: a && b"').structure).toBe("simple");
    });

    it("시퀀스와 파이프라인을 구분한다", () => {
        expect(analyzeCommand("npm run build && npm test").structure).toBe("sequence");
        expect(analyzeCommand("cat log.txt | grep error").structure).toBe("pipeline");
    });

    it("삭제 명령을 destructive로 표시한다", () => {
        expect(analyzeCommand("rm -rf build").overallEffect).toBe("destructive");
    });

    it("빈 명령을 방어적으로 처리한다", () => {
        expect(analyzeCommand("   ").steps).toEqual([]);
    });
});

describe("inferCommandSemantic", () => {
    it("검증 명령을 구현 레인의 run_test로 본다", () => {
        const semantic = inferCommandSemantic("npm test");

        expect(semantic.lane).toBe("implementation");
        expect(semantic.metadata.subtypeKey).toBe("run_test");
    });

    it("읽기 전용 명령을 탐색 레인의 shell_probe로 본다", () => {
        expect(inferCommandSemantic("ls -al").lane).toBe("exploration");
    });

    it("규칙 패턴에 걸리는 명령을 규칙 레인으로 올린다", () => {
        expect(inferCommandSemantic("npm run lint", ["npm run lint"]).lane).toBe("rule");
    });
});
