import type { TimelineLane } from "../monitoring/types.js";
import type { RuleId } from "./ids.js";
export interface EventClassificationReason {
    readonly kind: "keyword" | "action-prefix" | "action-keyword";
    readonly value: string;
}
export interface EventClassificationMatch {
    readonly ruleId: RuleId;
    readonly source?: "action-registry";
    readonly score: number;
    readonly lane?: TimelineLane;
    readonly tags: readonly string[];
    readonly reasons: readonly EventClassificationReason[];
}
export interface EventClassification {
    readonly lane: TimelineLane;
    readonly tags: readonly string[];
    readonly matches: readonly EventClassificationMatch[];
}
//# sourceMappingURL=types.d.ts.map