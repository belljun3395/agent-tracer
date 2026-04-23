import { describe, expect, it } from "vitest"
import { analyzeCommand } from "./command-analysis.js"

describe("analyzeCommand", () => {
    it("extracts a sed line range and file target", () => {
        const result = analyzeCommand("sed -n '1,220p' packages/server/src/application/sessions/end.runtime.session.usecase.test.ts")

        expect(result.structure).toBe("simple")
        expect(result.overallEffect).toBe("read_only")
        expect(result.steps[0]?.commandName).toBe("sed")
        expect(result.steps[0]?.operation).toBe("read_range")
        expect(result.steps[0]?.selectors?.lineRange).toBe("1,220")
        expect(result.steps[0]?.targets).toContainEqual({
            type: "file",
            value: "packages/server/src/application/sessions/end.runtime.session.usecase.test.ts",
        })
    })

    it("extracts git diff pathspec targets", () => {
        const result = analyzeCommand("git diff -- packages/server/src/application/tasks/complete.task.usecase.test.ts packages/server/src/application/tasks/start.task.usecase.test.ts")

        expect(result.steps[0]?.commandName).toBe("git")
        expect(result.steps[0]?.subcommand).toBe("diff")
        expect(result.steps[0]?.operation).toBe("inspect_diff")
        expect(result.steps[0]?.effect).toBe("read_only")
        expect(result.steps[0]?.targets.map((target) => target.value)).toEqual([
            "packages/server/src/application/tasks/complete.task.usecase.test.ts",
            "packages/server/src/application/tasks/start.task.usecase.test.ts",
        ])
    })

    it("extracts npm workspace test intent", () => {
        const result = analyzeCommand("npm --workspace @monitor/server test")

        expect(result.steps[0]?.commandName).toBe("npm")
        expect(result.steps[0]?.operation).toBe("run_test")
        expect(result.steps[0]?.workspace).toBe("@monitor/server")
        expect(result.steps[0]?.scriptName).toBe("test")
        expect(result.steps[0]?.targets).toContainEqual({ type: "workspace", value: "@monitor/server" })
        expect(result.overallEffect).toBe("execute_check")
    })

    it("represents pipelines and sequences separately", () => {
        const result = analyzeCommand("rg foo packages | head -20 && npm --workspace @monitor/server test")

        expect(result.structure).toBe("compound")
        expect(result.steps).toHaveLength(2)
        expect(result.steps[0]?.operation).toBe("pipeline")
        expect(result.steps[0]?.pipeline?.map((step) => step.commandName)).toEqual(["rg", "head"])
        expect(result.steps[0]?.pipeline?.[0]?.operation).toBe("search")
        expect(result.steps[0]?.pipeline?.[1]?.operation).toBe("limit_output")
        expect(result.steps[1]?.operatorFromPrevious).toBe("&&")
        expect(result.steps[1]?.operation).toBe("run_test")
    })

    it("marks failure-masked test commands", () => {
        const result = analyzeCommand("npm test || true")

        expect(result.failureMasked).toBe(true)
        expect(result.steps[0]?.operation).toBe("run_test")
        expect(result.steps[1]?.operatorFromPrevious).toBe("||")
    })

    it("keeps quoted paths together", () => {
        const result = analyzeCommand("sed -n '1,20p' 'path with space/file.ts'")

        expect(result.steps[0]?.operation).toBe("read_range")
        expect(result.steps[0]?.targets).toContainEqual({ type: "file", value: "path with space/file.ts" })
    })

    it("extracts write redirect targets", () => {
        const result = analyzeCommand("rg foo packages > out.txt")

        expect(result.steps[0]?.redirects).toContainEqual({ operator: ">", target: { type: "file", value: "out.txt" } })
        expect(result.steps[0]?.targets).toContainEqual({ type: "file", value: "out.txt" })
    })
})
