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

    it("sed -i를 쓰기로 본다", () => {
        expect(analyzeCommand("sed -i 's/a/b/' f.txt").overallEffect).toBe("write");
        expect(analyzeCommand("sed -n '1,5p' f.txt").overallEffect).toBe("read_only");
    });

    it("find의 삭제·실행 액션을 파괴적·쓰기로 본다", () => {
        expect(analyzeCommand("find . -name '*.tmp' -delete").overallEffect).toBe("destructive");
        expect(analyzeCommand("find . -type f -exec rm {} ;").overallEffect).toBe("destructive");
        expect(analyzeCommand("find . -type f -exec chmod 644 {} ;").overallEffect).toBe("write");
        expect(analyzeCommand("find . -name '*.ts'").overallEffect).toBe("read_only");
    });

    it("git 강제 push와 clean을 파괴적으로 본다", () => {
        expect(analyzeCommand("git push --force origin main").overallEffect).toBe("destructive");
        expect(analyzeCommand("git push -f").overallEffect).toBe("destructive");
        expect(analyzeCommand("git push origin main").overallEffect).toBe("network");
        expect(analyzeCommand("git clean -fd").overallEffect).toBe("destructive");
    });

    it("인자에 실린 SQL 삭제를 파괴적으로 본다", () => {
        expect(analyzeCommand('psql -c "drop table users"').overallEffect).toBe("destructive");
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

    it("래퍼로 감싼 러너를 벗겨 검증 명령으로 본다", () => {
        expect(inferCommandSemantic("npx vitest run").metadata.subtypeKey).toBe("run_test");
        expect(inferCommandSemantic("uv run pytest -q").metadata.subtypeKey).toBe("run_test");
        expect(inferCommandSemantic("go test ./...").metadata.subtypeKey).toBe("run_test");
        expect(inferCommandSemantic("cargo clippy").metadata.subtypeKey).toBe("run_lint");
    });

    it("패키지 매니저 경로와 직접 경로가 같은 러너에 같은 조작을 낸다", () => {
        // RUNNER_SPECS에는 있으나 옛 substring 목록에는 없어 두 경로가 갈리던 러너다.
        expect(inferCommandSemantic("npm run biome").metadata.subtypeKey).toBe("run_lint");
        expect(inferCommandSemantic("biome").metadata.subtypeKey).toBe("run_lint");
        expect(inferCommandSemantic("npx biome").metadata.subtypeKey).toBe("run_lint");
        expect(inferCommandSemantic("npm run ruff").metadata.subtypeKey).toBe("run_lint");
        expect(inferCommandSemantic("npm run mypy").metadata.subtypeKey).toBe("run_build");
    });

    it("스크립트 이름 자체가 조작을 드러내는 옛 판정을 지킨다", () => {
        expect(inferCommandSemantic("npm run test:unit").metadata.subtypeKey).toBe("run_test");
        expect(inferCommandSemantic("npm run eslint").metadata.subtypeKey).toBe("run_lint");
        expect(inferCommandSemantic("npm run build:prod").metadata.subtypeKey).toBe("run_build");
    });
});
