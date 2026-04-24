import type { Provider } from "@nestjs/common";
import type { IRuleCommandRepository } from "~application/index.js";
import {
    CreateRuleCommandUseCase,
    DeleteRuleCommandUseCase,
    GetRulePatternsUseCase,
    ListRuleCommandsUseCase,
} from "~application/rule-commands/index.js";
import { RULE_COMMAND_REPOSITORY_TOKEN } from "../database/database.provider.js";

export const RULE_COMMANDS_APPLICATION_PROVIDERS: Provider[] = [
    {
        provide: CreateRuleCommandUseCase,
        useFactory: (ruleCommands: IRuleCommandRepository) => new CreateRuleCommandUseCase(ruleCommands),
        inject: [RULE_COMMAND_REPOSITORY_TOKEN],
    },
    {
        provide: DeleteRuleCommandUseCase,
        useFactory: (ruleCommands: IRuleCommandRepository) => new DeleteRuleCommandUseCase(ruleCommands),
        inject: [RULE_COMMAND_REPOSITORY_TOKEN],
    },
    {
        provide: ListRuleCommandsUseCase,
        useFactory: (ruleCommands: IRuleCommandRepository) => new ListRuleCommandsUseCase(ruleCommands),
        inject: [RULE_COMMAND_REPOSITORY_TOKEN],
    },
    {
        provide: GetRulePatternsUseCase,
        useFactory: (ruleCommands: IRuleCommandRepository) => new GetRulePatternsUseCase(ruleCommands),
        inject: [RULE_COMMAND_REPOSITORY_TOKEN],
    },
];

export const RULE_COMMANDS_APPLICATION_EXPORTS = [
    CreateRuleCommandUseCase,
    DeleteRuleCommandUseCase,
    ListRuleCommandsUseCase,
    GetRulePatternsUseCase,
] as const;
