import type {
    CommandAnalysis,
    CommandConfidence,
    CommandEffect,
    CommandSequencePart,
    CommandStep,
    CommandStructure,
} from "~runtime/domain/ingest/model/command.analysis.model.js";
import {
    DESTRUCTIVE_COMMANDS,
    LIST_COMMANDS,
    NETWORK_COMMANDS,
    READ_COMMANDS,
    SEARCH_COMMANDS,
    STREAM_TRANSFORM_COMMANDS,
    WRITE_COMMANDS,
    analyzeFind,
    analyzeList,
    analyzeRead,
    analyzeRipgrep,
    analyzeSearch,
    analyzeSed,
    analyzeStreamTransform,
    buildBaseStep,
    withStep,
} from "~runtime/domain/ingest/model/command.classifier.model.js";
import {analyzeGit} from "~runtime/domain/ingest/model/command.git.model.js";
import {analyzePackageManager} from "~runtime/domain/ingest/model/command.package.model.js";
import {
    extractRedirects,
    isEnvAssignment,
    splitPipeline,
    splitSequence,
    tokenizeShell,
} from "~runtime/domain/ingest/model/command.parser.model.js";
import {containsComplexShell, pathTargets, uniqueTargets, urlTargets} from "~runtime/domain/ingest/model/command.target.model.js";
import type {EventLane} from "~runtime/domain/ingest/model/event.model.js";
import type {EventSemanticMetadata} from "~runtime/domain/ingest/model/tool.metadata.model.js";

type ExecutionSubtype = "run_test" | "run_lint" | "run_build" | "verify";

/** 명령이 속하는 레인과 시맨틱과 구조 분석을 함께 담는다. */
export interface CommandSemantic {
    readonly lane: Extract<EventLane, "exploration" | "implementation" | "rule">;
    readonly metadata: EventSemanticMetadata;
    readonly analysis: CommandAnalysis;
}

export function analyzeCommand(command: string): CommandAnalysis {
    const raw = command.trim();
    if (!raw) {
        return {raw: command, structure: "simple", overallEffect: "unknown", confidence: "low", steps: []};
    }
    const sequence = splitSequence(raw);
    const steps = sequence.map((part) => analyzeSequencePart(part));
    const failureMasked = detectFailureMasked(sequence);
    return {
        raw,
        structure: resolveStructure(sequence, steps),
        overallEffect: combineEffects(steps.map((step) => step.effect)),
        confidence: combineConfidence(steps.map((step) => step.confidence)),
        steps,
        ...(failureMasked ? {failureMasked} : {}),
    };
}

/** 명령의 효과로 레인과 시맨틱을 정한다. */
export function inferCommandSemantic(command: string, rulePatterns: readonly string[] = []): CommandSemantic {
    const normalized = command.trim().toLowerCase();
    const analysis = analyzeCommand(command);
    const entityName = analysis.steps[0]?.commandName || firstCommandToken(command) || "shell";

    const matchesRule = rulePatterns.some((pattern) => {
        const needle = pattern.trim().toLowerCase();
        return needle.length > 0 && normalized.includes(needle);
    });
    if (matchesRule) {
        return {
            lane: "rule",
            metadata: terminalSemantic("rule_check", "Rule check", "execution", "execute", entityName),
            analysis,
        };
    }

    const executionSubtype = executionSubtypeFromAnalysis(analysis);
    if (executionSubtype) {
        return {
            lane: "implementation",
            metadata: terminalSemantic(
                executionSubtype,
                subtypeLabel(executionSubtype),
                "execution",
                "execute",
                entityName,
            ),
            analysis,
        };
    }

    if (analysis.overallEffect === "read_only" || isExplorationProbe(normalized)) {
        return {
            lane: "exploration",
            metadata: terminalSemantic(
                "shell_probe",
                "Shell probe",
                "shell",
                analysis.steps[0]?.operation ?? "probe",
                entityName,
            ),
            analysis,
        };
    }

    return {
        lane: "implementation",
        metadata: terminalSemantic("run_command", "Run command", "execution", "execute", entityName),
        analysis,
    };
}

function terminalSemantic(
    subtypeKey: EventSemanticMetadata["subtypeKey"],
    subtypeLabelText: string,
    subtypeGroup: "execution" | "shell",
    operation: string,
    entityName: string,
): EventSemanticMetadata {
    return {
        subtypeKey,
        subtypeLabel: subtypeLabelText,
        subtypeGroup,
        toolFamily: "terminal",
        operation,
        entityType: "command",
        entityName,
        sourceTool: "Bash",
    };
}

function analyzeSequencePart(part: CommandSequencePart): CommandStep {
    const pipelineParts = splitPipeline(part.raw);
    if (pipelineParts.length > 1) {
        const pipeline = pipelineParts.map((rawStep) => analyzeSimpleCommand({raw: rawStep}));
        return {
            raw: part.raw,
            commandName: pipeline[0]?.commandName ?? "pipeline",
            operation: "pipeline",
            targets: uniqueTargets(pipeline.flatMap((step) => step.targets)),
            effect: combineEffects(pipeline.map((step) => step.effect)),
            confidence: combineConfidence(pipeline.map((step) => step.confidence)),
            ...(part.operatorFromPrevious ? {operatorFromPrevious: part.operatorFromPrevious} : {}),
            pipeline,
        };
    }
    return analyzeSimpleCommand(part);
}

function analyzeSimpleCommand(part: CommandSequencePart): CommandStep {
    const {tokens: commandTokens, redirects} = extractRedirects(tokenizeShell(part.raw));
    const usefulTokens = commandTokens.filter((token) => !isEnvAssignment(token));
    const commandName = usefulTokens[0] ?? "shell";
    const args = usefulTokens.slice(1);
    const base = buildBaseStep(part, commandName, redirects);

    if (commandName === "sed") return analyzeSed(base, args);
    if (commandName === "git") return analyzeGit(base, args);
    if (["npm", "pnpm", "yarn"].includes(commandName)) return analyzePackageManager(base, args);
    if (commandName === "vitest") return withStep(base, {operation: "run_test", effect: "execute_check", confidence: "high"});
    if (commandName === "tsc") return withStep(base, {operation: "run_build", effect: "execute_check", confidence: "high"});
    if (commandName === "eslint") return withStep(base, {operation: "run_lint", effect: "execute_check", confidence: "high"});
    if (STREAM_TRANSFORM_COMMANDS.has(commandName)) return analyzeStreamTransform(base, args);
    if (commandName === "find") return analyzeFind(base, args);
    if (commandName === "rg") return analyzeRipgrep(base, args);
    if (SEARCH_COMMANDS.has(commandName)) return analyzeSearch(base, args);
    if (READ_COMMANDS.has(commandName)) return analyzeRead(base, args);
    if (LIST_COMMANDS.has(commandName)) return analyzeList(base, args);
    if (DESTRUCTIVE_COMMANDS.has(commandName)) {
        return withStep(base, {operation: "delete_file", effect: "destructive", targets: pathTargets(args), confidence: "medium"});
    }
    if (WRITE_COMMANDS.has(commandName)) {
        return withStep(base, {operation: "write_file", effect: "write", targets: pathTargets(args), confidence: "medium"});
    }
    if (NETWORK_COMMANDS.has(commandName)) {
        return withStep(base, {operation: "fetch_url", effect: "network", targets: urlTargets(args), confidence: "medium"});
    }

    return withStep(base, {
        operation: "unknown",
        effect: redirects.some((redirect) => redirect.operator.includes(">")) ? "write" : "unknown",
        confidence: containsComplexShell(part.raw) ? "low" : "medium",
    });
}

function resolveStructure(
    sequence: readonly CommandSequencePart[],
    steps: readonly CommandStep[],
): CommandStructure {
    if (sequence.length > 1) {
        return steps.some((step) => step.pipeline && step.pipeline.length > 0) ? "compound" : "sequence";
    }
    if (steps[0]?.pipeline && steps[0].pipeline.length > 0) return "pipeline";
    return "simple";
}

function combineEffects(effects: readonly CommandEffect[]): CommandEffect {
    if (effects.includes("destructive")) return "destructive";
    if (effects.includes("write")) return "write";
    if (effects.includes("network")) return "network";
    if (effects.includes("execute_check")) return "execute_check";
    if (effects.length > 0 && effects.every((effect) => effect === "read_only")) return "read_only";
    return "unknown";
}

function combineConfidence(values: readonly CommandConfidence[]): CommandConfidence {
    if (values.includes("low")) return "low";
    if (values.includes("medium")) return "medium";
    return "high";
}

function detectFailureMasked(sequence: readonly CommandSequencePart[]): boolean {
    return sequence.some((part) => part.operatorFromPrevious === "||" && /^(true|:)\b/.test(part.raw.trim()));
}

function executionSubtypeFromAnalysis(analysis: CommandAnalysis): ExecutionSubtype | null {
    const operations = analysis.steps.flatMap((step) => [
        step.operation,
        ...(step.pipeline?.map((pipelineStep) => pipelineStep.operation) ?? []),
    ]);
    if (operations.includes("run_test")) return "run_test";
    if (operations.includes("run_lint")) return "run_lint";
    if (operations.includes("run_build")) return "run_build";
    if (operations.some((operation) => operation === "verify" || operation === "execute_check")) return "verify";
    return null;
}

function subtypeLabel(subtypeKey: ExecutionSubtype): string {
    switch (subtypeKey) {
        case "run_test": return "Run test";
        case "run_lint": return "Run lint";
        case "run_build": return "Run build";
        case "verify": return "Verify";
    }
}

function isExplorationProbe(normalized: string): boolean {
    return /^(pwd|ls|tree|find|fd|rg|grep|cat|sed|head|tail|wc|stat|file|which|whereis)\b/.test(normalized)
        || /^git\s+(status|diff|show|log)\b/.test(normalized);
}

function firstCommandToken(command: string): string {
    const [first = ""] = command.trim().split(/\s+/, 1);
    return first.replace(/^['"]+|['"]+$/g, "");
}
