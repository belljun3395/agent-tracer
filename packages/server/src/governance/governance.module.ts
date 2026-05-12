import { Module, type DynamicModule } from "@nestjs/common";
import { RuleModule } from "./rule/rule.module.js";
import { RuleGenerationModule } from "./rule-generation/rule-generation.module.js";
import { SettingsModule } from "./settings/settings.module.js";
import { TaskCleanupModule } from "./task-cleanup/task-cleanup.module.js";
import { VerificationModule } from "./verification/verification.module.js";

/**
 * Governance bounded context — composes the rule, verification, settings,
 * and rule-generation sub-packages into a single Nest module.
 */
@Module({})
export class GovernanceModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        const verificationModule = VerificationModule.register(databaseModule);
        const ruleModule = RuleModule.register(databaseModule, verificationModule);
        const settingsModule = SettingsModule.register(databaseModule);
        const ruleGenerationModule = RuleGenerationModule.register(databaseModule);
        const taskCleanupModule = TaskCleanupModule.register(databaseModule);
        return {
            module: GovernanceModule,
            imports: [
                verificationModule,
                ruleModule,
                settingsModule,
                ruleGenerationModule,
                taskCleanupModule,
            ],
        };
    }
}
