import type { EventLane } from "../events/kinds.type.js";
import type { EventSemanticMetadata } from "../events/metadata.type.js";
import { analyzeCommand, type CommandAnalysis } from "./command-analysis.js";

export type CommandLane = Extract<EventLane, "exploration" | "implementation" | "rule">

export interface CommandSemantic {
    readonly lane: CommandLane
    readonly metadata: EventSemanticMetadata
    readonly analysis: CommandAnalysis
}

export function inferCommandSemantic(command: string, rulePatterns: readonly string[] = []): CommandSemantic {
    const normalized = command.trim().toLowerCase()
    const analysis = analyzeCommand(command)
    const commandEntity = analysis.steps[0]?.commandName || firstCommandToken(command) || "shell"

    if (rulePatterns.some((p) => {
        const pattern = p.trim().toLowerCase()
        return pattern.length > 0 && normalized.includes(pattern)
    })) {
        return ruleCheckResult(commandEntity, analysis)
    }

    const executionSubtype = executionSubtypeFromAnalysis(analysis)
    if (executionSubtype) {
        return executionResult(commandEntity, analysis, executionSubtype)
    }

    if (analysis.overallEffect === "read_only" || isLegacyExplorationProbe(normalized)) {
        return explorationResult(commandEntity, analysis)
    }

    if (/\b(rule|policy|guard|constraint|conformance)\b/.test(normalized)) {
        return ruleCheckResult(commandEntity, analysis)
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
        analysis,
    }
}

function explorationResult(commandEntity: string, analysis: CommandAnalysis): CommandSemantic {
    return {
        lane: "exploration",
        metadata: {
            subtypeKey: "shell_probe",
            subtypeLabel: "Shell probe",
            subtypeGroup: "shell",
            toolFamily: "terminal",
            operation: analysis.steps[0]?.operation ?? "probe",
            entityType: "command",
            entityName: commandEntity,
            sourceTool: "Bash",
        },
        analysis,
    }
}

function executionResult(commandEntity: string, analysis: CommandAnalysis, subtypeKey: "run_test" | "run_lint" | "run_build" | "verify"): CommandSemantic {
    return {
        lane: "implementation",
        metadata: {
            subtypeKey,
            subtypeLabel: subtypeLabel(subtypeKey),
            subtypeGroup: "execution",
            toolFamily: "terminal",
            operation: "execute",
            entityType: "command",
            entityName: commandEntity,
            sourceTool: "Bash",
        },
        analysis,
    }
}

function ruleCheckResult(commandEntity: string, analysis: CommandAnalysis): CommandSemantic {
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
        analysis,
    }
}

function executionSubtypeFromAnalysis(analysis: CommandAnalysis): "run_test" | "run_lint" | "run_build" | "verify" | null {
    const operations = flattenOperations(analysis)
    if (operations.includes("run_test")) return "run_test"
    if (operations.includes("run_lint")) return "run_lint"
    if (operations.includes("run_build")) return "run_build"
    if (operations.some((operation) => operation === "verify" || operation === "execute_check")) return "verify"
    return null
}

function flattenOperations(analysis: CommandAnalysis): readonly string[] {
    return analysis.steps.flatMap((step) => [
        step.operation,
        ...(step.pipeline?.map((pipelineStep) => pipelineStep.operation) ?? []),
    ])
}

function subtypeLabel(subtypeKey: "run_test" | "run_lint" | "run_build" | "verify"): string {
    switch (subtypeKey) {
        case "run_test": return "Run test"
        case "run_lint": return "Run lint"
        case "run_build": return "Run build"
        case "verify": return "Verify"
    }
}

function isLegacyExplorationProbe(normalized: string): boolean {
    return /^(pwd|ls|tree|find|fd|rg|grep|cat|sed|head|tail|wc|stat|file|which|whereis)\b/.test(normalized)
        || /^git\s+(status|diff|show|log)\b/.test(normalized)
}

function firstCommandToken(command: string): string {
    const [first = ""] = command.trim().split(/\s+/, 1)
    return first.replace(/^['"]+|['"]+$/g, "")
}
