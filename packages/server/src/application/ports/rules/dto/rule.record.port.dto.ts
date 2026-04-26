import type { Rule } from "~domain/verification/index.js";

export interface RuleRecordPortDto extends Rule {
    readonly signature: string;
}
