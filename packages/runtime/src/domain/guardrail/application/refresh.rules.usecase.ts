import type {GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";
import type {RuleSourcePort} from "~runtime/domain/guardrail/port/rule.source.port.js";

/** 서버가 잠깐 죽어도 데몬이 규칙 없이 계속 돌 수 있도록 실패를 흡수한다. */
export class RefreshRulesUsecase {
    constructor(private readonly source: RuleSourcePort) {}

    async execute(): Promise<readonly GuardrailRule[] | null> {
        try {
            return await this.source.fetchAll();
        } catch {
            return null;
        }
    }
}
