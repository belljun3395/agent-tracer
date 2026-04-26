import type { RuleScope, RuleSource } from "~domain/verification/rule/type/rule.value.type.js";

export interface RuleListFilterPortDto {
    readonly scope?: RuleScope;
    readonly taskId?: string;
    readonly source?: RuleSource;
}
