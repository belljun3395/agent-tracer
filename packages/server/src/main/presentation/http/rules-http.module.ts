import { Module, type DynamicModule } from "@nestjs/common";
import { RuleCommandController } from "~adapters/http/command/index.js";
import { RuleQueryController, TaskRulesQueryController } from "~adapters/http/query/index.js";
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
