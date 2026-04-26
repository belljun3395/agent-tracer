import { Module, type DynamicModule } from "@nestjs/common";
import {
    GlobalRuleCommandCommandController,
    TaskRuleCommandCommandController,
} from "~adapters/http/command/index.js";
import {
    GlobalRuleCommandQueryController,
    TaskRuleCommandQueryController,
} from "~adapters/http/query/index.js";

@Module({
    controllers: [
        GlobalRuleCommandCommandController,
        GlobalRuleCommandQueryController,
        TaskRuleCommandCommandController,
        TaskRuleCommandQueryController,
    ],
})
export class RuleCommandsHttpModule {
    static register(ruleCommandsApplicationModule: DynamicModule): DynamicModule {
        return {
            module: RuleCommandsHttpModule,
            imports: [ruleCommandsApplicationModule],
        };
    }
}
