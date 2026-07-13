import type {RuleGenerationOutcome} from "~runtime/domain/rulegen/model/rule.job.model.js";
import type {RuleGenerationSpec} from "~runtime/domain/rulegen/model/rulegen.spec.model.js";
import type {RuleGeneratorPort} from "~runtime/domain/rulegen/port/rule.generator.port.js";

const EMPTY_OUTCOME: RuleGenerationOutcome = {
    candidates: [],
    costUsd: 0,
    numTurns: 1,
    usage: null,
    error: null,
};

export class InMemoryRuleGenerator implements RuleGeneratorPort {
    readonly specs: RuleGenerationSpec[] = [];

    constructor(private readonly outcome: RuleGenerationOutcome = EMPTY_OUTCOME) {}

    async generate(spec: RuleGenerationSpec): Promise<RuleGenerationOutcome> {
        this.specs.push(spec);
        return this.outcome;
    }
}
