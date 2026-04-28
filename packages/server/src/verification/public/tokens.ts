/**
 * DI tokens for cross-module access to the verification module.
 */
export const VERIFICATION_BACKFILL = "VERIFICATION_BACKFILL";
export const VERIFICATION_VERDICT_COUNT = "VERIFICATION_VERDICT_COUNT";
export const VERIFICATION_POST_PROCESSOR = "VERIFICATION_POST_PROCESSOR";
export const VERIFICATION_VERDICT_INVALIDATION = "VERIFICATION_VERDICT_INVALIDATION";

/**
 * Legacy bridge token — TurnQueryRepository as a structural query source.
 * Consumed by the task module's TurnQueryAccessAdapter to surface turn
 * summaries without depending on verification internals.
 */
export const TURN_QUERY_REPOSITORY_TOKEN = "TURN_QUERY_REPOSITORY";
