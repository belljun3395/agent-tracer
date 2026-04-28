/**
 * DI tokens for cross-module access to the rule module.
 */
export const RULE_READ = "RULE_READ";
export const RULE_WRITE = "RULE_WRITE";
export const RULE_SIGNATURE_QUERY = "RULE_SIGNATURE_QUERY";

/**
 * Legacy bridge token — exposes the rule module's RuleRepository to
 * verification (IRuleAccess) so verification can resolve rules via DI without
 * depending on rule internals. Remapped to the TypeORM RuleRepository inside
 * the rule module.
 */
export const RULE_REPOSITORY_TOKEN = "RULE_REPOSITORY";
