import type { RuleReadPort } from "~application/ports/rules/rule.read.port.js";
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

export class ListRulesUseCase {
    constructor(private readonly ruleRepo: RuleReadPort) {}

    async execute(input: ListRulesUseCaseIn = {}): Promise<ListRulesUseCaseOut> {
        const rules = await this.ruleRepo.list(input);
        return { rules: rules.map(mapRule) };
    }
}

export class ListRulesForTaskUseCase {
    constructor(private readonly ruleRepo: RuleReadPort) {}

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
