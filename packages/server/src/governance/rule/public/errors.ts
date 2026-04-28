/**
 * Public error classes — re-exported for cross-module callers (e.g. the
 * platform exception filter) so internal `common/errors.ts` stays internal.
 */
export { RuleNotFoundError, InvalidRuleError } from "../common/errors.js";
