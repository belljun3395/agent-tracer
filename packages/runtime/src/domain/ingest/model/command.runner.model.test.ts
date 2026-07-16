import {describe, expect, it} from "vitest";
import type {CommandStep} from "~runtime/domain/ingest/model/command.analysis.model.js";
import {runnerStepFrom, unwrapCommand} from "~runtime/domain/ingest/model/command.runner.model.js";

function baseStep(commandName: string): CommandStep {
    return {raw: commandName, commandName, operation: "unknown", targets: [], effect: "unknown", confidence: "medium"};
}

describe("unwrapCommand", () => {
    it("접두사 래퍼를 벗긴다", () => {
        expect(unwrapCommand(["npx", "vitest", "run"])).toEqual(["vitest", "run"]);
        expect(unwrapCommand(["bunx", "eslint"])).toEqual(["eslint"]);
    });

    it("서브커맨드 래퍼는 두 토큰을 벗긴다", () => {
        expect(unwrapCommand(["uv", "run", "pytest"])).toEqual(["pytest"]);
        expect(unwrapCommand(["poetry", "run", "pytest", "-q"])).toEqual(["pytest", "-q"]);
        expect(unwrapCommand(["python", "-m", "pytest"])).toEqual(["pytest"]);
    });

    it("래퍼 플래그와 그 값을 건너뛴다", () => {
        expect(unwrapCommand(["npx", "-y", "vitest"])).toEqual(["vitest"]);
        expect(unwrapCommand(["npx", "-p", "foo", "vitest"])).toEqual(["vitest"]);
    });

    it("래퍼가 중첩돼도 안쪽까지 벗긴다", () => {
        expect(unwrapCommand(["npx", "-y", "bunx", "tsc"])).toEqual(["tsc"]);
    });

    it("서브커맨드가 안 맞으면 벗기지 않는다", () => {
        expect(unwrapCommand(["uv", "pip", "install"])).toEqual(["uv", "pip", "install"]);
    });

    it("래퍼가 아니면 그대로 둔다", () => {
        expect(unwrapCommand(["git", "status"])).toEqual(["git", "status"]);
    });
});

describe("runnerStepFrom", () => {
    it("서브커맨드 없는 러너를 매칭한다", () => {
        expect(runnerStepFrom(baseStep("vitest"), "vitest", ["run"])?.operation).toBe("run_test");
        expect(runnerStepFrom(baseStep("eslint"), "eslint", [])?.operation).toBe("run_lint");
    });

    it("서브커맨드로 같은 명령을 갈라 본다", () => {
        expect(runnerStepFrom(baseStep("go"), "go", ["test", "./..."])?.operation).toBe("run_test");
        expect(runnerStepFrom(baseStep("go"), "go", ["build"])?.operation).toBe("run_build");
        expect(runnerStepFrom(baseStep("cargo"), "cargo", ["clippy"])?.operation).toBe("run_lint");
    });

    it("러너 테이블에 없으면 null이다", () => {
        expect(runnerStepFrom(baseStep("go"), "go", ["run", "main.go"])).toBeNull();
        expect(runnerStepFrom(baseStep("cat"), "cat", ["x"])).toBeNull();
    });
});
