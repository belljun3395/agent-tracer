import type { EventLane } from "../events/kinds.type.js";
import type { EventSemanticMetadata } from "../events/metadata.type.js";

export type CommandLane = Extract<EventLane, "exploration" | "implementation">

export interface CommandSemantic {
    readonly lane: CommandLane
    readonly metadata: EventSemanticMetadata
}

/** Pattern-matches the shell command string against known probe/test/lint/build/verify/rule patterns. Returns the appropriate `CommandLane` and full semantic metadata. Unrecognised commands fall back to `run_command` on the implementation lane. */
export function inferCommandSemantic(command: string): CommandSemantic {
    const normalized = command.trim().toLowerCase()
    const commandToken = firstCommandToken(command)
    const commandEntity = commandToken || "shell"

    if (
        /^(pwd|ls|tree|find|fd|rg|grep|cat|sed|head|tail|wc|stat|file|which|whereis)\b/.test(normalized) ||
        /^git\s+(status|diff|show|log)\b/.test(normalized) ||
        /^(npm|pnpm|yarn|bun)\s+(ls|list)\b/.test(normalized)
    ) {
        return {
            lane: "exploration",
            metadata: {
                subtypeKey: "shell_probe",
                subtypeLabel: "Shell probe",
                subtypeGroup: "shell",
                toolFamily: "terminal",
                operation: "probe",
                entityType: "command",
                entityName: commandEntity,
                sourceTool: "Bash",
            },
        }
    }

    if (/\b(rule|policy|guard|constraint|conformance)\b/.test(normalized)) {
        return {
            lane: "implementation",
            metadata: {
                subtypeKey: "rule_check",
                subtypeLabel: "Rule check",
                subtypeGroup: "execution",
                toolFamily: "terminal",
                operation: "execute",
                entityType: "command",
                entityName: commandEntity,
                sourceTool: "Bash",
            },
        }
    }

    if (
        /\b(pytest|vitest|jest|ava|mocha|phpunit|rspec)\b/.test(normalized) ||
        /\b(npm|pnpm|yarn|bun)\s+(run\s+)?test\b/.test(normalized) ||
        /\b(go|cargo)\s+test\b/.test(normalized) ||
        /\bplaywright\s+test\b/.test(normalized) ||
        /\bcypress\s+run\b/.test(normalized)
    ) {
        return {
            lane: "implementation",
            metadata: {
                subtypeKey: "run_test",
                subtypeLabel: "Run test",
                subtypeGroup: "execution",
                toolFamily: "terminal",
                operation: "execute",
                entityType: "command",
                entityName: commandEntity,
                sourceTool: "Bash",
            },
        }
    }

    if (
        /\b(eslint|stylelint|ruff|flake8|prettier|biome|oxlint)\b/.test(normalized) ||
        /\b(npm|pnpm|yarn|bun)\s+(run\s+)?lint\b/.test(normalized) ||
        /\b(cargo|go)\s+fmt\b/.test(normalized)
    ) {
        return {
            lane: "implementation",
            metadata: {
                subtypeKey: "run_lint",
                subtypeLabel: "Run lint",
                subtypeGroup: "execution",
                toolFamily: "terminal",
                operation: "execute",
                entityType: "command",
                entityName: commandEntity,
                sourceTool: "Bash",
            },
        }
    }

    if (
        /\b(typecheck|type-check|check-types|verify|validate|doctor|audit)\b/.test(normalized) ||
        /\btsc\b.*--noemit\b/.test(normalized) ||
        /\bcargo\s+check\b/.test(normalized) ||
        /\bgo\s+vet\b/.test(normalized) ||
        /\bmypy\b/.test(normalized)
    ) {
        return {
            lane: "implementation",
            metadata: {
                subtypeKey: "verify",
                subtypeLabel: "Verify",
                subtypeGroup: "execution",
                toolFamily: "terminal",
                operation: "execute",
                entityType: "command",
                entityName: commandEntity,
                sourceTool: "Bash",
            },
        }
    }

    if (
        /\b(npm|pnpm|yarn|bun)\s+(run\s+)?build\b/.test(normalized) ||
        /\b(next|vite|webpack|rollup)\s+build\b/.test(normalized) ||
        /\bcargo\s+build\b/.test(normalized) ||
        /\bgo\s+build\b/.test(normalized) ||
        /\bdocker\s+build\b/.test(normalized) ||
        /\btsc\b/.test(normalized)
    ) {
        return {
            lane: "implementation",
            metadata: {
                subtypeKey: "run_build",
                subtypeLabel: "Run build",
                subtypeGroup: "execution",
                toolFamily: "terminal",
                operation: "execute",
                entityType: "command",
                entityName: commandEntity,
                sourceTool: "Bash",
            },
        }
    }

    return {
        lane: "implementation",
        metadata: {
            subtypeKey: "run_command",
            subtypeLabel: "Run command",
            subtypeGroup: "execution",
            toolFamily: "terminal",
            operation: "execute",
            entityType: "command",
            entityName: commandEntity,
            sourceTool: "Bash",
        },
    }
}

function firstCommandToken(command: string): string {
    const [first = ""] = command.trim().split(/\s+/, 1)
    return first.replace(/^['"]+|['"]+$/g, "")
}
