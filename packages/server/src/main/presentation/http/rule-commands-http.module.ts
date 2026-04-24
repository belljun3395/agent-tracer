import { Module, type DynamicModule } from "@nestjs/common";
import {
    GlobalRuleCommandWriteController,
    TaskRuleCommandWriteController,
} from "~adapters/http/ingest/index.js";
import {
    GlobalRuleCommandController,
    TaskRuleCommandController,
} from "~adapters/http/query/index.js";

@Module({
    controllers: [
        GlobalRuleCommandController,
        GlobalRuleCommandWriteController,
        TaskRuleCommandController,
        TaskRuleCommandWriteController,
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
