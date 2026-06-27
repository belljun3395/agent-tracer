import { Inject, Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { RULE_PERSISTENCE_PORT } from "./outbound/tokens.js";
import type { IRulePersistence } from "./outbound/rule.persistence.port.js";
import { CreateRuleUseCase } from "./create.rule.usecase.js";
import { DeleteRuleUseCase } from "./delete.rule.usecase.js";
import type {
    DemoteRuleToTaskUseCaseIn,
    DemoteRuleToTaskUseCaseOut,
} from "./dto/demote.rule.to.task.usecase.dto.js";
import { InvalidRuleError, RuleNotFoundError } from "../common/errors.js";

export type {
    DemoteRuleToTaskUseCaseIn,
    DemoteRuleToTaskUseCaseOut,
} from "./dto/demote.rule.to.task.usecase.dto.js";

/**
 * Demote a global rule back to a task-scoped rule. Mirror of
 * PromoteRuleToGlobalUseCase: soft-delete the global rule (keeps any past
 * verdicts for audit), create a fresh task-scoped rule with the same
 * trigger/expect via CreateRuleUseCase. Backfill fires automatically inside
 * CreateRuleUseCase so the new rule lights up immediately for past turns of
 * the chosen task.
 */
@Injectable()
export class DemoteRuleToTaskUseCase {
    constructor(
        @Inject(RULE_PERSISTENCE_PORT) private readonly ruleRepo: IRulePersistence,
        private readonly createRule: CreateRuleUseCase,
        private readonly deleteRule: DeleteRuleUseCase,
    ) {}

    @Transactional()
    async execute(input: DemoteRuleToTaskUseCaseIn): Promise<DemoteRuleToTaskUseCaseOut> {
        const existing = await this.ruleRepo.findById(input.ruleId);
        if (!existing) throw new RuleNotFoundError(input.ruleId);
        if (existing.scope !== "global") {
            throw new InvalidRuleError("Only global rules can be demoted");
        }
        if (!input.taskId.trim()) {
            throw new InvalidRuleError("Demote requires a target taskId");
        }
        await this.deleteRule.execute(input.ruleId);
        const created = await this.createRule.execute({
            name: existing.name,
            ...(existing.trigger ? { trigger: existing.trigger } : {}),
            ...(existing.triggerOn ? { triggerOn: existing.triggerOn } : {}),
            expect: existing.expect,
            scope: "task",
            taskId: input.taskId,
            source: existing.source,
            severity: existing.severity,
            ...(existing.rationale ? { rationale: existing.rationale } : {}),
        });
        return { rule: created.rule };
    }
}
