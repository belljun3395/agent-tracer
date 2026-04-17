/**
 * Bash command semantic classifier.
 *
 * Maps shell command strings to structured SemanticMetadata so the Agent Tracer
 * monitor can categorize terminal events into exploration vs. implementation lanes.
 *
 * Classification rules (in precedence order):
 *   shell_probe   — read-only inspection commands (ls, find, git status/diff/log, …)
 *   rule_check    — policy/conformance commands
 *   run_test      — test runner invocations (jest, pytest, cargo test, …)
 *   run_lint      — linter invocations (eslint, ruff, biome, …)
 *   verify        — type-checker/validator invocations (tsc --noemit, mypy, …)
 *   run_build     — build tool invocations (npm run build, cargo build, tsc, …)
 *   run_command   — everything else (default)
 *
 * SemanticMetadata is typed against EventSemanticMetadata from @monitor/core,
 * which is the shared contract between the plugin and the monitor server.
 */
import type { EventSemanticMetadata } from "@monitor/core";
import { toTrimmedString } from "../util/utils.js";
import type { JsonObject } from "../util/utils.js";
import type { TimelineLane } from "../util/lane.js";

export type SemanticMetadata = EventSemanticMetadata;

/** Bash commands can only classify into exploration or implementation lanes. */
export type CommandLane = Extract<TimelineLane, "exploration" | "implementation">;

export interface CommandSemantic {
    readonly lane: CommandLane;
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

function humanizeSubtypeKey(value: string): string {
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
