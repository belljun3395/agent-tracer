import type { EventClassificationMatch } from "./types.js";
/**
 * Scores an action name against the action registry and returns the best lane hint.
 */
export declare function classifyActionName(actionName?: string): EventClassificationMatch | null;
/**
 * Splits an action name into normalized tokens while discarding ignorable prefixes.
 */
export declare function tokenizeActionName(actionName: string): readonly string[];
//# sourceMappingURL=action-registry.d.ts.map