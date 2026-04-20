import type { EventLane } from "../events/kinds.type.js";
import type { EventSemanticMetadata } from "../events/metadata.type.js";

export type CommandLane = Extract<EventLane, "exploration" | "implementation">

export interface CommandSemantic {
    readonly lane: CommandLane
    readonly metadata: EventSemanticMetadata
}

/** Pattern-matches shell commands against a narrow set of read-only probes and rule checks. Everything else falls back to `run_command` on the implementation lane. */
export function inferCommandSemantic(command: string): CommandSemantic {
    const normalized = command.trim().toLowerCase()
    const commandToken = firstCommandToken(command)
    const commandEntity = commandToken || "shell"

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
