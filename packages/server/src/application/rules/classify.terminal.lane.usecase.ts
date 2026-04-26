import type { IRuleRepository } from "~application/ports/repository/rule.repository.js";

export interface TerminalLaneCandidate {
    readonly kind: string;
    readonly taskId: string;
    readonly lane: string;
    readonly metadata?: Record<string, unknown> | undefined;
}

/**
 * Classifies terminal command events into the "rule" lane when their
 * command string matches an active Bash rule (or any active rule with
 * undefined `expect.tool`) for the event's task.
 *
 * Uses each rule's `expect.commandMatches` substrings (case-insensitive)
 * for matching — same semantics as the legacy RuleCommand patterns.
 */
export class ClassifyTerminalLaneUseCase {
    constructor(private readonly ruleRepo: IRuleRepository) {}

    async execute<T extends TerminalLaneCandidate>(events: readonly T[]): Promise<readonly T[]> {
        const terminalTaskIds = [
            ...new Set(
                events
                    .filter((event) => event.kind === "terminal.command")
                    .map((event) => event.taskId),
            ),
        ];
        if (terminalTaskIds.length === 0) return events;

        const patternsByTask = new Map<string, readonly string[]>();
        await Promise.all(
            terminalTaskIds.map(async (taskId) => {
                const rules = await this.ruleRepo.findActiveForTurn(taskId);
                const patterns: string[] = [];
                for (const rule of rules) {
                    if (rule.expect.tool !== undefined && rule.expect.tool !== "Bash") continue;
                    if (!rule.expect.commandMatches) continue;
                    for (const pattern of rule.expect.commandMatches) {
                        patterns.push(pattern);
                    }
                }
                patternsByTask.set(taskId, patterns);
            }),
        );

        return events.map((event) => {
            if (event.kind !== "terminal.command") return event;
            const command = event.metadata?.["command"];
            if (typeof command !== "string") return event;
            const patterns = patternsByTask.get(event.taskId) ?? [];
            const matches = patterns.some((pattern) =>
                command.toLowerCase().includes(pattern.trim().toLowerCase()),
            );
            return matches ? ({ ...event, lane: "rule" } as T) : event;
        });
    }
}
