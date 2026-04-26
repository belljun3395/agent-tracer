import type { RuleScope, RuleSource } from "~domain/verification/index.js";

export interface RuleListFilterPortDto {
    readonly scope?: RuleScope;
    readonly taskId?: string;
    readonly source?: RuleSource;
}
