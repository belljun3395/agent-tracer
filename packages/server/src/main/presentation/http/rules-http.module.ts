import { Module, type DynamicModule } from "@nestjs/common";
import { RuleCommandController } from "~adapters/http/command/controllers/rule/rule.command.controller.js";
import { RuleQueryController } from "~adapters/http/query/controllers/rule/rule.query.controller.js";
import { TaskRulesQueryController } from "~adapters/http/query/controllers/rule/task.rules.query.controller.js";
import type { DatabaseModule } from "../database/database.module.js";

@Module({
    controllers: [RuleCommandController, RuleQueryController, TaskRulesQueryController],
})
export class RulesHttpModule {
    static register(
        rulesApplicationModule: DynamicModule,
        databaseModule: ReturnType<typeof DatabaseModule.forRoot>,
    ): DynamicModule {
        return {
            module: RulesHttpModule,
            imports: [rulesApplicationModule, databaseModule],
        };
    }
}
