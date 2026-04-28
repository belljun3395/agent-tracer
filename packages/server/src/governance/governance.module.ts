import { Module, type DynamicModule } from "@nestjs/common";
import { RuleModule } from "./rule/rule.module.js";
import { VerificationModule } from "./verification/verification.module.js";

/**
 * Governance bounded context — composes the rule and verification
 * sub-packages into a single Nest module. Tight bidirectional coupling
 * (rule → verification iservices for invalidation; verification → rule
 * predicates/types) is now intra-module.
 *
 * Public surface continues to live under each sub-package's `public/` —
 * external modules import through `~governance/rule/public/...` /
 * `~governance/verification/public/...` directly.
 */
@Module({})
export class GovernanceModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        const verificationModule = VerificationModule.register(databaseModule);
        const ruleModule = RuleModule.register(databaseModule, verificationModule);
        return {
            module: GovernanceModule,
            imports: [verificationModule, ruleModule],
        };
    }
}
