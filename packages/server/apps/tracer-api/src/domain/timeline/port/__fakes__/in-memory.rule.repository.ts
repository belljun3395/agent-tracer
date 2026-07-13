import { RULE_REVIEW_STATE, RULE_SCOPE } from "@monitor/kernel";
import type { RuleEntity } from "@monitor/tracer-domain";
import type { RuleRepositoryPort } from "../rule.repository.port.js";

/** 규칙 저장소 포트의 인메모리 대역이다. */
export class InMemoryRuleRepository implements RuleRepositoryPort {
    private readonly rows = new Map<string, RuleEntity>();

    seed(...rules: readonly RuleEntity[]): void {
        for (const rule of rules) this.rows.set(rule.id, rule);
    }

    all(): RuleEntity[] {
        return [...this.rows.values()];
    }

    findById(id: string): Promise<RuleEntity | null> {
        return Promise.resolve(this.rows.get(id) ?? null);
    }

    findApplicable(userId: string, taskId: string): Promise<RuleEntity[]> {
        const rules = this.inScope(userId, taskId).filter((rule) => rule.reviewState === RULE_REVIEW_STATE.active);
        return Promise.resolve(rules);
    }

    findAllForListing(userId: string, taskId: string): Promise<RuleEntity[]> {
        return Promise.resolve(this.inScope(userId, taskId));
    }

    findAllByUser(userId: string): Promise<RuleEntity[]> {
        return Promise.resolve(this.all().filter((rule) => rule.userId === userId && rule.deletedAt === null));
    }

    async findApplicableSignatures(userId: string, taskId: string): Promise<string[]> {
        const rules = await this.findAllForListing(userId, taskId);
        return rules.map((rule) => rule.signature);
    }

    upsert(rule: RuleEntity): Promise<void> {
        this.rows.set(rule.id, rule);
        return Promise.resolve();
    }

    private inScope(userId: string, taskId: string): RuleEntity[] {
        return this.all().filter(
            (rule) =>
                rule.userId === userId &&
                rule.deletedAt === null &&
                (rule.scope === RULE_SCOPE.global || rule.taskId === taskId),
        );
    }
}
