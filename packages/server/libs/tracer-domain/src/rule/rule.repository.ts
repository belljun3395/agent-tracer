import { IsNull, type Repository } from "typeorm";
import type { RuleEntity } from "./rule.entity.js";
import { RULE_REVIEW_STATE, RULE_SCOPE } from "@monitor/kernel";
import { upsertByKeys } from "../persistence/repository.upsert.js";

export class RuleRepository {
    constructor(private readonly repo: Repository<RuleEntity>) {}

    async findById(id: string): Promise<RuleEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    // 판정기·가드레일이 쓰는 조회이며 발효된 규칙만 준다.
    async findApplicable(userId: string, taskId: string): Promise<RuleEntity[]> {
        // 삭제되지 않고 발효된 규칙 중 전역이거나 해당 작업에 매인 것.
        const active = RULE_REVIEW_STATE.active;
        return this.repo.find({
            where: [
                { userId, deletedAt: IsNull(), reviewState: active, scope: RULE_SCOPE.global },
                { userId, deletedAt: IsNull(), reviewState: active, scope: RULE_SCOPE.task, taskId },
            ],
        });
    }

    // 목록 화면이 쓰는 조회이며, 승인 대기 규칙까지 보여야 사람이 승인할 수 있다.
    async findAllForListing(userId: string, taskId: string): Promise<RuleEntity[]> {
        return this.repo.find({
            where: [
                { userId, deletedAt: IsNull(), scope: RULE_SCOPE.global },
                { userId, deletedAt: IsNull(), scope: RULE_SCOPE.task, taskId },
            ],
        });
    }

    async findApplicableSignatures(userId: string, taskId: string): Promise<string[]> {
        const rules = await this.repo.find({
            select: { signature: true },
            where: [
                { userId, deletedAt: IsNull(), scope: RULE_SCOPE.global },
                { userId, deletedAt: IsNull(), scope: RULE_SCOPE.task, taskId },
            ],
        });
        return rules.map((rule) => rule.signature);
    }

    async findAllByUser(userId: string): Promise<RuleEntity[]> {
        // 소프트삭제된 규칙은 제외한다.
        return this.repo.find({ where: { userId, deletedAt: IsNull() } });
    }

    async upsert(rule: RuleEntity): Promise<void> {
        await upsertByKeys(this.repo, rule, ["id"]);
    }
}
