import { describe, expect, it, vi, afterEach } from "vitest"

describe("defaultTaskTitle", () => {
    afterEach(() => {
        vi.resetModules()
    })

    it("returns title in 'Claude Code — {project-name}' format", async () => {
        vi.doMock("~claude-code/hooks/util/paths.const.js", () => ({
            PROJECT_DIR: "/Users/user/projects/my-app",
        }))
        const { defaultTaskTitle } = await import("./paths.js")
        expect(defaultTaskTitle()).toBe("Claude Code — my-app")
    })

    it("uses the base directory name of the project path", async () => {
        vi.doMock("~claude-code/hooks/util/paths.const.js", () => ({
            PROJECT_DIR: "/workspace/agent-tracer",
        }))
        const { defaultTaskTitle } = await import("./paths.js")
        expect(defaultTaskTitle()).toBe("Claude Code — agent-tracer")
    })
})

describe("relativeProjectPath", () => {
    afterEach(() => {
        vi.resetModules()
    })

    it("converts absolute path to project-relative path", async () => {
        vi.doMock("~claude-code/hooks/util/paths.const.js", () => ({
            PROJECT_DIR: "/workspace/my-project",
        }))
        const { relativeProjectPath } = await import("./paths.js")
        expect(relativeProjectPath("/workspace/my-project/src/index.ts")).toBe("src/index.ts")
    })

    it("returns the original path when file is outside the project root", async () => {
        vi.doMock("~claude-code/hooks/util/paths.const.js", () => ({
            PROJECT_DIR: "/workspace/my-project",
        }))
        const { relativeProjectPath } = await import("./paths.js")
        expect(relativeProjectPath("/other-project/src/index.ts")).toBe("/other-project/src/index.ts")
    })

    it("returns empty string for empty input", async () => {
        vi.doMock("~claude-code/hooks/util/paths.const.js", () => ({
            PROJECT_DIR: "/workspace/my-project",
        }))
        const { relativeProjectPath } = await import("./paths.js")
        expect(relativeProjectPath("")).toBe("")
    })

    it("uses forward slashes regardless of OS separator", async () => {
        vi.doMock("~claude-code/hooks/util/paths.const.js", () => ({
            PROJECT_DIR: "/workspace/my-project",
        }))
        const { relativeProjectPath } = await import("./paths.js")
        const result = relativeProjectPath("/workspace/my-project/src/components/Button.tsx")
        expect(result).toBe("src/components/Button.tsx")
        expect(result).not.toContain("\\")
    })
})
