import { Injectable } from "@nestjs/common";
import { RuleRepository } from "../../repository/rule/rule.repository.js";
import type {
    ListRulesForTaskUseCaseIn,
    ListRulesForTaskUseCaseOut,
    ListRulesUseCaseIn,
    ListRulesUseCaseOut,
} from "./dto/list.rules.usecase.dto.js";
import { mapRule } from "./dto/rule.dto.mapper.js";

@Injectable()
export class ListRulesUseCase {
    constructor(
        private readonly ruleRepo: RuleRepository,
    ) {}

    async execute(input: ListRulesUseCaseIn = {}): Promise<ListRulesUseCaseOut> {
        const rules = await this.ruleRepo.list(input);
        return { rules: rules.map(mapRule) };
    }
}

@Injectable()
export class ListRulesForTaskUseCase {
    constructor(
        private readonly ruleRepo: RuleRepository,
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
