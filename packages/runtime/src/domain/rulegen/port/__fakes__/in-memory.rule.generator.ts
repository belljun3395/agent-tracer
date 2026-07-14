import type {RuleGenerationOutcome} from "~runtime/domain/rulegen/model/rule.job.model.js";
import type {RuleGenerationSpec} from "~runtime/domain/rulegen/model/rulegen.spec.model.js";
import type {RulegenToolset} from "~runtime/domain/rulegen/model/rulegen.tool.model.js";
import type {RuleGeneratorPort} from "~runtime/domain/rulegen/port/rule.generator.port.js";

const EMPTY_OUTCOME: RuleGenerationOutcome = {
    candidates: [],
    costUsd: 0,
    numTurns: 1,
    usage: null,
    steps: [],
    error: null,
};

/** 실제 실행기는 중단을 던지지 않고 오류 결과로 답하므로 가짜도 그렇게 답한다. */
const ABORTED_OUTCOME: RuleGenerationOutcome = {
    candidates: [],
    costUsd: 0.4,
    numTurns: 3,
    usage: null,
    steps: [],
    error: "This operation was aborted",
};

export class InMemoryRuleGenerator implements RuleGeneratorPort {
    readonly specs: RuleGenerationSpec[] = [];
    readonly toolsets: RulegenToolset[] = [];

    constructor(private readonly outcome: RuleGenerationOutcome = EMPTY_OUTCOME) {}

    async generate(
        spec: RuleGenerationSpec,
        toolset: RulegenToolset,
        signal: AbortSignal,
    ): Promise<RuleGenerationOutcome> {
        this.specs.push(spec);
        this.toolsets.push(toolset);
        if (signal.aborted) return ABORTED_OUTCOME;
        return this.outcome;
    }
}
