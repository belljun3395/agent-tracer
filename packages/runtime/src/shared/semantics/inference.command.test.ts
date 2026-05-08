import { describe, expect, it } from "vitest"
import { inferCommandSemantic } from "./inference.command.js"

describe("inferCommandSemantic", () => {
    describe("user-defined rule patterns", () => {
        it("matches a rule pattern and returns rule lane with rule_check subtype", () => {
            // Arrange
            const command = "npm run lint"
            const rulePatterns = ["npm run lint"]

            // Act
            const result = inferCommandSemantic(command, rulePatterns)

            // Assert
            expect(result.lane).toBe("rule")
            expect(result.metadata.subtypeKey).toBe("rule_check")
        })

        it("sets entityName to the first command token", () => {
            // Arrange
            const command = "npm run lint"
            const rulePatterns = ["npm run lint"]

            // Act
            const result = inferCommandSemantic(command, rulePatterns)

            // Assert
            expect(result.metadata.entityName).toBe("npm")
        })

        it("classifies lint commands when no rulePatterns provided", () => {
            // Arrange
            const command = "npm run lint"

            // Act
            const result = inferCommandSemantic(command)

            // Assert
            expect(result.lane).toBe("implementation")
            expect(result.metadata.subtypeKey).toBe("run_lint")
        })

        it("matches rule pattern case-insensitively", () => {
            // Arrange
            const command = "NPM RUN LINT"
            const rulePatterns = ["npm run lint"]

            // Act
            const result = inferCommandSemantic(command, rulePatterns)

            // Assert
            expect(result.lane).toBe("rule")
            expect(result.metadata.subtypeKey).toBe("rule_check")
        })

        it("matches when the second pattern in a list matches", () => {
            // Arrange
            const command = "npm run typecheck"
            const rulePatterns = ["npm run lint", "npm run typecheck"]

            // Act
            const result = inferCommandSemantic(command, rulePatterns)

            // Assert
            expect(result.lane).toBe("rule")
            expect(result.metadata.subtypeKey).toBe("rule_check")
        })

        it("ignores blank rule patterns", () => {
            // Arrange
            const command = "npm run lint"
            const rulePatterns = ["", "   "]

            // Act
            const result = inferCommandSemantic(command, rulePatterns)

            // Assert
            expect(result.lane).toBe("implementation")
            expect(result.metadata.subtypeKey).toBe("run_lint")
        })

        it("checks rule patterns before built-in exploration check", () => {
            // Arrange - "ls" would normally be exploration, but a rule pattern takes precedence
            const command = "ls --check-policy"
            const rulePatterns = ["--check-policy"]

            // Act
            const result = inferCommandSemantic(command, rulePatterns)

            // Assert
            expect(result.lane).toBe("rule")
        })
    })

    describe("built-in exploration probes", () => {
        it.each([
            "pwd",
            "ls -la",
            "tree",
            "find . -name '*.ts'",
            "fd inference",
            "rg inferCommandSemantic",
            "grep -R pattern src",
            "cat package.json",
            "sed -n '1,20p' package.json",
            "head package.json",
            "tail package.json",
            "wc -l package.json",
            "stat package.json",
            "file package.json",
            "which node",
            "whereis node",
            "git status",
            "git diff",
            "git show HEAD",
            "git log --oneline",
        ])("maps '%s' to exploration lane with shell_probe subtype", (command) => {
            // Arrange

            // Act
            const result = inferCommandSemantic(command)

            // Assert
            expect(result.lane).toBe("exploration")
            expect(result.metadata.subtypeKey).toBe("shell_probe")
        })
    })

    describe("rule keywords without configured patterns", () => {
        it.each(["rule", "policy", "guard", "constraint", "conformance"])(
            "does NOT classify keyword '%s' as rule lane on its own",
            (keyword) => {
                // Arrange — without an explicit rulePattern matching the
                // command, plain keyword presence must NOT promote a
                // command into the rule lane. Otherwise arbitrary text
                // like `git commit -m "Add rules"` ends up looking like
                // a compliance event when no rules are configured.
                const command = `check ${keyword} settings`

                // Act
                const result = inferCommandSemantic(command)

                // Assert — falls through to the implementation default.
                expect(result.lane).toBe("implementation")
                expect(result.metadata.subtypeKey).toBe("run_command")
            }
        )

        it("still respects rulePatterns when they explicitly mention the keyword", () => {
            // Arrange — opt-in via rulePatterns is the supported route.
            const command = "check policy settings"
            const rulePatterns = ["check policy"]

            // Act
            const result = inferCommandSemantic(command, rulePatterns)

            // Assert
            expect(result.lane).toBe("rule")
            expect(result.metadata.subtypeKey).toBe("rule_check")
        })
    })

    describe("implementation fallback", () => {
        it.each([
            ["npm test", "run_test"],
            ["npm run lint", "run_lint"],
            ["npm run build", "run_build"],
            ["vitest run", "run_test"],
            ["tsc --noEmit", "run_build"],
        ])("maps '%s' to %s", (command, subtypeKey) => {
            // Arrange

            // Act
            const result = inferCommandSemantic(command)

            // Assert
            expect(result.lane).toBe("implementation")
            expect(result.metadata.subtypeKey).toBe(subtypeKey)
            expect(result.analysis.steps[0]?.operation).toBe(subtypeKey)
        })

        it("maps generic command to implementation lane with run_command subtype", () => {
            // Arrange
            const command = "echo hello"

            // Act
            const result = inferCommandSemantic(command)

            // Assert
            expect(result.lane).toBe("implementation")
            expect(result.metadata.subtypeKey).toBe("run_command")
        })

        it("uses shell as entityName for blank commands", () => {
            // Arrange
            const command = "   "

            // Act
            const result = inferCommandSemantic(command)

            // Assert
            expect(result.metadata.entityName).toBe("shell")
        })

        it("strips surrounding quotes from the first command token", () => {
            // Arrange
            const command = "'npm' run test"

            // Act
            const result = inferCommandSemantic(command)

            // Assert
            expect(result.metadata.entityName).toBe("npm")
        })

        it("returns command analysis with semantic inference", () => {
            // Arrange
            const command = "rg foo packages | head -20 && npm --workspace @monitor/server test"

            // Act
            const result = inferCommandSemantic(command)

            // Assert
            expect(result.analysis.structure).toBe("compound")
            expect(result.analysis.steps[0]?.pipeline?.map((step) => step.commandName)).toEqual(["rg", "head"])
            expect(result.metadata.subtypeKey).toBe("run_test")
        })
    })
})
