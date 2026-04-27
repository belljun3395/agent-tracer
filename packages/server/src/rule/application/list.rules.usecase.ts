import { Inject, Injectable } from "@nestjs/common";
import { RULE_PERSISTENCE_PORT } from "./outbound/tokens.js";
import type { IRulePersistence } from "./outbound/rule.persistence.port.js";
import type {
    ListRulesForTaskUseCaseIn,
    ListRulesForTaskUseCaseOut,
    ListRulesUseCaseIn,
    ListRulesUseCaseOut,
} from "./dto/list.rules.usecase.dto.js";
import { mapRule } from "./dto/rule.dto.mapper.js";

export type {
    ListRulesForTaskUseCaseIn,
    ListRulesForTaskUseCaseOut,
    ListRulesUseCaseIn,
    ListRulesUseCaseOut,
} from "./dto/list.rules.usecase.dto.js";
export type { ListRulesUseCaseIn as ListRulesInput } from "./dto/list.rules.usecase.dto.js";
export type { ListRulesUseCaseOut as ListRulesResult } from "./dto/list.rules.usecase.dto.js";
export type { ListRulesForTaskUseCaseIn as ListRulesForTaskInput } from "./dto/list.rules.usecase.dto.js";
export type { ListRulesForTaskUseCaseOut as ListRulesForTaskResult } from "./dto/list.rules.usecase.dto.js";

@Injectable()
export class ListRulesUseCase {
    constructor(
        @Inject(RULE_PERSISTENCE_PORT) private readonly ruleRepo: IRulePersistence,
    ) {}

    async execute(input: ListRulesUseCaseIn = {}): Promise<ListRulesUseCaseOut> {
        const rules = await this.ruleRepo.list(input);
        return { rules: rules.map(mapRule) };
    }
}

@Injectable()
export class ListRulesForTaskUseCase {
    constructor(
        @Inject(RULE_PERSISTENCE_PORT) private readonly ruleRepo: IRulePersistence,
    ) {}

    async execute(input: ListRulesForTaskUseCaseIn): Promise<ListRulesForTaskUseCaseOut> {
        const [task, global] = await Promise.all([
            this.ruleRepo.list({ scope: "task", taskId: input.taskId }),
            this.ruleRepo.list({ scope: "global" }),
        ]);
        return {
            task: task.map(mapRule),
            global: global.map(mapRule),
        };
    }
}
