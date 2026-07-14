import type {
    EventEvidence,
    ExistingRuleEvidence,
    TurnDigest,
} from "~runtime/domain/rulegen/model/evidence.model.js";
import type {RuleEvidencePort} from "~runtime/domain/rulegen/port/rule.evidence.port.js";

export class InMemoryRuleEvidence implements RuleEvidencePort {
    readonly turnCalls: string[] = [];
    readonly eventCalls: {taskId: string; limit: number}[] = [];
    ruleCalls = 0;

    constructor(
        private readonly turns: readonly TurnDigest[] = [],
        private readonly events: readonly EventEvidence[] = [],
        private readonly existingRules: readonly ExistingRuleEvidence[] = [],
    ) {}

    async fetchTurns(taskId: string): Promise<readonly TurnDigest[]> {
        this.turnCalls.push(taskId);
        return this.turns;
    }

    async fetchEvents(taskId: string, limit: number): Promise<readonly EventEvidence[]> {
        this.eventCalls.push({taskId, limit});
        return this.events.slice(-limit);
    }

    async fetchExistingRules(): Promise<readonly ExistingRuleEvidence[]> {
        this.ruleCalls += 1;
        return this.existingRules;
    }
}
