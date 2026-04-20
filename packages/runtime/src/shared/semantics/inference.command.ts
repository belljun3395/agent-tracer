import type { EventLane } from "../events/kinds.type.js";
import type { EventSemanticMetadata } from "../events/metadata.type.js";

export type CommandLane = Extract<EventLane, "exploration" | "implementation" | "rule">

export interface CommandSemantic {
    readonly lane: CommandLane
    readonly metadata: EventSemanticMetadata
}

export function inferCommandSemantic(command: string, rulePatterns: readonly string[] = []): CommandSemantic {
    const normalized = command.trim().toLowerCase()
    const commandToken = firstCommandToken(command)
    const commandEntity = commandToken || "shell"

    if (rulePatterns.some((p) => normalized.includes(p.trim().toLowerCase()))) {
        return ruleCheckResult(commandEntity)
    }

    if (
        /^(pwd|ls|tree|find|fd|rg|grep|cat|sed|head|tail|wc|stat|file|which|whereis)\b/.test(normalized) ||
        /^git\s+(status|diff|show|log)\b/.test(normalized)
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
        return ruleCheckResult(commandEntity)
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

function ruleCheckResult(commandEntity: string): CommandSemantic {
    return {
        lane: "rule",
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

function firstCommandToken(command: string): string {
    const [first = ""] = command.trim().split(/\s+/, 1)
    return first.replace(/^['"]+|['"]+$/g, "")
}
