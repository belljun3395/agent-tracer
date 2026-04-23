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

        it("does not apply rule lane when no rulePatterns provided", () => {
            // Arrange
            const command = "npm run lint"

            // Act
            const result = inferCommandSemantic(command)

            // Assert
            expect(result.lane).toBe("implementation")
            expect(result.metadata.subtypeKey).toBe("run_command")
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
            expect(result.metadata.subtypeKey).toBe("run_command")
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

    describe("built-in keyword rule check", () => {
        it.each(["rule", "policy", "guard", "constraint", "conformance"])(
            "maps command containing keyword '%s' to rule lane",
            (keyword) => {
                // Arrange
                const command = `check ${keyword} settings`

                // Act
                const result = inferCommandSemantic(command)

                // Assert
                expect(result.lane).toBe("rule")
                expect(result.metadata.subtypeKey).toBe("rule_check")
            }
        )
    })

    describe("implementation fallback", () => {
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
    })
})
