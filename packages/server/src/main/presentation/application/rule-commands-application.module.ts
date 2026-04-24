import { Module, type DynamicModule } from "@nestjs/common";
import {
    RULE_COMMANDS_APPLICATION_EXPORTS,
    RULE_COMMANDS_APPLICATION_PROVIDERS,
} from "./rule-commands.providers.js";

@Module({
    providers: RULE_COMMANDS_APPLICATION_PROVIDERS,
    exports: [...RULE_COMMANDS_APPLICATION_EXPORTS],
})
export class RuleCommandsApplicationModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: RuleCommandsApplicationModule,
            imports: [databaseModule],
        };
    }
}
