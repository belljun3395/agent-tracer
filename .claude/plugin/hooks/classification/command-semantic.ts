import type { EventSemanticMetadata } from "@monitor/core";
import { toTrimmedString } from "../lib/utils.js";
import type { JsonObject } from "../lib/utils.js";

export type SemanticMetadata = EventSemanticMetadata;

export interface CommandSemantic {
    readonly lane: "exploration" | "implementation";
    readonly metadata: SemanticMetadata;
}

export function buildSemanticMetadata(input: SemanticMetadata): JsonObject {
    return {
        subtypeKey: input.subtypeKey,
        subtypeLabel: input.subtypeLabel ?? humanizeSubtypeKey(input.subtypeKey),
        subtypeGroup: input.subtypeGroup,
        toolFamily: input.toolFamily,
        operation: input.operation,
        ...(input.entityType ? { entityType: input.entityType } : {}),
        ...(input.entityName ? { entityName: input.entityName } : {}),
        ...(input.sourceTool ? { sourceTool: input.sourceTool } : {}),
        ...(input.importance ? { importance: input.importance } : {})
    };
}

export function inferCommandLane(command: string): "exploration" | "implementation" {
    return inferCommandSemantic(command).lane;
}

export function inferCommandSemantic(command: string): CommandSemantic {
    const normalized = command.trim().toLowerCase();
    const commandToken = firstCommandToken(command);
    const commandEntity = commandToken || "shell";

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
                sourceTool: "Bash"
            }
        };
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
                sourceTool: "Bash"
            }
        };
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
                sourceTool: "Bash"
            }
        };
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
                sourceTool: "Bash"
            }
        };
    }

    if (
        /\b(typecheck|type-check|check-types|verify|validate|doctor|audit)\b/.test(normalized) ||
        /\btsc\b.*\b--noemit\b/.test(normalized) ||
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
                sourceTool: "Bash"
            }
        };
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
                sourceTool: "Bash"
            }
        };
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
            sourceTool: "Bash"
        }
    };
}

function firstCommandToken(command: string): string {
    const [first = ""] = command.trim().split(/\s+/, 1);
    return first.replace(/^['"]+|['"]+$/g, "");
}

export function humanizeSubtypeKey(value: string): string {
    return value
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

// Re-export for use by explore/file semantic modules
export function extractToolFilePath(toolInput: JsonObject): string {
    return (
        toTrimmedString(toolInput.file_path) ||
        toTrimmedString(toolInput.path) ||
        toTrimmedString(toolInput.pattern)
    );
}
