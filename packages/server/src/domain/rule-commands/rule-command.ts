import type { RuleCommandDraft } from "./model/rule-command.model.js";

export function createRuleCommandDraft(input: {
    readonly pattern: string;
    readonly label: string;
    readonly taskId?: string;
}): RuleCommandDraft {
    const pattern = input.pattern.trim();
    const label = input.label.trim();
    if (!pattern) throw new Error("Pattern must not be empty");
    if (!label) throw new Error("Label must not be empty");
    return {
        pattern,
        label,
        ...(input.taskId ? { taskId: input.taskId } : {}),
    };
}

export function commandMatchesRulePatterns(command: string, patterns: readonly string[]): boolean {
    const normalizedCommand = command.toLowerCase();
    return patterns.some((pattern) => {
        const normalizedPattern = pattern.trim().toLowerCase();
        return normalizedPattern.length > 0 && normalizedCommand.includes(normalizedPattern);
    });
}
