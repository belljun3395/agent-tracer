import type {
    EventEvidence,
    ExistingRuleEvidence,
    TurnDigest,
} from "~runtime/domain/rulegen/model/evidence.model.js";
import type {RuleEvidencePort} from "~runtime/domain/rulegen/port/rule.evidence.port.js";

export class InMemoryRuleEvidence implements RuleEvidencePort {
    constructor(
        private readonly turns: readonly TurnDigest[] = [],
        private readonly events: readonly EventEvidence[] = [],
        private readonly existingRules: readonly ExistingRuleEvidence[] = [],
    ) {}

    async fetchTurns(): Promise<readonly TurnDigest[]> {
        return this.turns;
    }

    async fetchEvents(): Promise<readonly EventEvidence[]> {
        return this.events;
    }

    async fetchExistingRules(): Promise<readonly ExistingRuleEvidence[]> {
        return this.existingRules;
    }
}
