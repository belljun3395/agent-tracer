import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RULE_REPOSITORY_TOKEN } from "./public/tokens.js";
import { RuleController } from "./api/rule.controller.js";
import { RuleIngestController } from "./api/rule.ingest.controller.js";
import { TaskRulesQueryController } from "./api/task.rules.query.controller.js";
import { CreateRuleUseCase } from "./application/create.rule.usecase.js";
import { DeleteRuleUseCase } from "./application/delete.rule.usecase.js";
import {
    ListRulesForTaskUseCase,
    ListRulesUseCase,
} from "./application/list.rules.usecase.js";
import { NOTIFICATION_PUBLISHER_PORT, RULE_PERSISTENCE_PORT } from "./application/outbound/tokens.js";
import { DemoteRuleToTaskUseCase } from "./application/demote.rule.to.task.usecase.js";
import { PromoteRuleToGlobalUseCase } from "./application/promote.rule.to.global.usecase.js";
import { RegisterSuggestionUseCase } from "./application/register.suggestion.usecase.js";
import { UpdateRuleUseCase } from "./application/update.rule.usecase.js";
import { RuleNotificationPublisherAdapter } from "./adapter/notification.publisher.adapter.js";
import { RuleEntity } from "./domain/rule.entity.js";
import {
    RULE_READ,
    RULE_SIGNATURE_QUERY,
    RULE_WRITE,
} from "./public/tokens.js";
import { RuleRepository } from "./repository/rule.repository.js";

@Module({})
export class RuleModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: RuleModule,
            imports: [
                TypeOrmModule.forFeature([RuleEntity]),
                databaseModule,
            ],
            controllers: [
                RuleController,
                RuleIngestController,
                TaskRulesQueryController,
            ],
            providers: [
                RuleRepository,

                { provide: RULE_REPOSITORY_TOKEN, useExisting: RuleRepository },

                RuleNotificationPublisherAdapter,

                CreateRuleUseCase,
                UpdateRuleUseCase,
                DeleteRuleUseCase,
                ListRulesUseCase,
                ListRulesForTaskUseCase,
                PromoteRuleToGlobalUseCase,
                DemoteRuleToTaskUseCase,
                RegisterSuggestionUseCase,

                { provide: RULE_READ, useExisting: RuleRepository },
                { provide: RULE_WRITE, useExisting: RuleRepository },
                { provide: RULE_SIGNATURE_QUERY, useExisting: RuleRepository },

                { provide: RULE_PERSISTENCE_PORT, useExisting: RuleRepository },
                { provide: NOTIFICATION_PUBLISHER_PORT, useExisting: RuleNotificationPublisherAdapter },
            ],
            exports: [
                RULE_READ,
                RULE_WRITE,
                RULE_SIGNATURE_QUERY,
                RULE_REPOSITORY_TOKEN,
                ListRulesUseCase,
                RegisterSuggestionUseCase,

                RULE_PERSISTENCE_PORT,
            ],
        };
    }
}
