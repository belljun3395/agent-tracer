/**
 * Public rule predicates / normalizers — pure helpers safe to expose to
 * cross-module consumers (verification's tool-action matching, turn evaluation).
 */
export {
    
    isCommandExpectedAction,
    canonicalizeToolName,
    normalizeRuleExpectedAction,
} from "../domain/rule.expected-action.js";
