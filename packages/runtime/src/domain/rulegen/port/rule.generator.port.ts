import type {RuleGenerationOutcome} from "~runtime/domain/rulegen/model/rule.job.model.js";
import type {RuleGenerationSpec} from "~runtime/domain/rulegen/model/rulegen.spec.model.js";
import type {RulegenToolset} from "~runtime/domain/rulegen/model/rulegen.tool.model.js";

/** 규칙 생성 명세를 도구 루프로 실행해 제안 후보를 내는 실행기다. */
export interface RuleGeneratorPort {
    generate(
        spec: RuleGenerationSpec,
        toolset: RulegenToolset,
        signal: AbortSignal,
    ): Promise<RuleGenerationOutcome>;
}
