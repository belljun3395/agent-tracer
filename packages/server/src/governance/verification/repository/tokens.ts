/**
 * Module-internal DI tokens. These tokens are consumed only by verification
 * internals (services, usecases, post-processors). Cross-module consumers
 * must reach through ~governance/verification/public/.
 */
export const TURN_REPOSITORY_TOKEN = "TURN_REPOSITORY";
export const VERDICT_REPOSITORY_TOKEN = "VERDICT_REPOSITORY";
export const RULE_ENFORCEMENT_REPOSITORY_TOKEN = "RULE_ENFORCEMENT_REPOSITORY";
