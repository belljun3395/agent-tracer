import type { GetRulePatternsUseCase } from "./get.rule-patterns.usecase.js";

export interface TerminalLaneCandidate {
    readonly kind: string;
    readonly taskId: string;
    readonly lane: string;
    readonly metadata?: Record<string, unknown> | undefined;
}

export class ClassifyTerminalLaneUseCase {
    constructor(private readonly getRulePatterns: GetRulePatternsUseCase) {}

    async execute<T extends TerminalLaneCandidate>(events: readonly T[]): Promise<readonly T[]> {
        const terminalTaskIds = [...new Set(
            events
                .filter((event) => event.kind === "terminal.command")
                .map((event) => event.taskId),
        )];
        if (terminalTaskIds.length === 0) return events;

        const patternsByTask = new Map(
            await Promise.all(
                terminalTaskIds.map(async (taskId) => [taskId, (await this.getRulePatterns.execute({ taskId })).patterns] as const),
            ),
        );

        return events.map((event) => {
            if (event.kind !== "terminal.command") return event;
            const command = event.metadata?.["command"];
            if (typeof command !== "string") return event;
            const patterns = patternsByTask.get(event.taskId) ?? [];
            const matches = patterns.some((pattern) => command.toLowerCase().includes(pattern.trim().toLowerCase()));
            return matches ? { ...event, lane: "rule" } as T : event;
        });
    }
}
