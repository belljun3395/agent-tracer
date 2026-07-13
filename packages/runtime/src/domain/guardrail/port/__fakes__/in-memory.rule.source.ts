import type {GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";
import type {RuleSourcePort} from "~runtime/domain/guardrail/port/rule.source.port.js";

export class InMemoryRuleSource implements RuleSourcePort {
    constructor(private readonly rules: readonly GuardrailRule[] = []) {}

    async fetchAll(): Promise<readonly GuardrailRule[]> {
        return this.rules;
    }
}
