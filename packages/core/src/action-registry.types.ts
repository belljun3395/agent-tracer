import type { TimelineLane } from "./domain/types.js";
export interface ActionPrefixRule {
    readonly lane: TimelineLane;
    readonly prefixes: readonly string[];
    readonly tags: readonly string[];
}
export interface ActionKeywordRule {
    readonly lane: TimelineLane;
    readonly keywords: readonly string[];
    readonly tags: readonly string[];
}
