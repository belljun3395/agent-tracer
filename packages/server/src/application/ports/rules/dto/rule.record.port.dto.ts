import type { Rule } from "~domain/verification/rule/model/rule.model.js";

export interface RuleRecordPortDto extends Rule {
    readonly signature: string;
}
