import type {RuleGenerationOutcome} from "~runtime/domain/rulegen/model/rule.job.model.js";
import type {RuleGenerationSpec} from "~runtime/domain/rulegen/model/rulegen.spec.model.js";
import type {
    RulegenToolInput,
    RulegenToolName,
    RulegenToolset,
} from "~runtime/domain/rulegen/model/rulegen.tool.model.js";
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

/** 결과를 내기 전에 모델처럼 도구를 먼저 부르게 하는 대본이다. */
export interface ScriptedToolPull {
    readonly tool: RulegenToolName;
    readonly input: RulegenToolInput;
}

export class InMemoryRuleGenerator implements RuleGeneratorPort {
    readonly specs: RuleGenerationSpec[] = [];
    readonly toolsets: RulegenToolset[] = [];
    readonly pulls: ScriptedToolPull[] = [];
    private readonly outcomes: readonly RuleGenerationOutcome[];

    constructor(...outcomes: readonly RuleGenerationOutcome[]) {
        this.outcomes = outcomes.length === 0 ? [EMPTY_OUTCOME] : outcomes;
    }

    async generate(
        spec: RuleGenerationSpec,
        toolset: RulegenToolset,
        signal: AbortSignal,
    ): Promise<RuleGenerationOutcome> {
        this.specs.push(spec);
        this.toolsets.push(toolset);
        if (signal.aborted) return ABORTED_OUTCOME;
        for (const pull of this.pulls) await toolset[pull.tool](pull.input);
        // 대본이 실행 횟수보다 짧으면 마지막 결과를 되풀이한다.
        return this.outcomes[Math.min(this.specs.length - 1, this.outcomes.length - 1)]!;
    }
}
