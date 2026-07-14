import { IsNull, type Repository } from "typeorm";
import type { RuleEntity } from "./rule.entity.js";
import { RULE_REVIEW_STATE } from "@monitor/kernel";
import { upsertByKeys } from "../persistence/repository.upsert.js";

export class RuleRepository {
    constructor(private readonly repo: Repository<RuleEntity>) {}

    async findById(id: string): Promise<RuleEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    // 판정기·가드레일이 쓰는 조회이며 발효된 규칙만 준다.
    async findApplicable(userId: string, taskId: string): Promise<RuleEntity[]> {
        return this.repo.find({
            where: { userId, taskId, deletedAt: IsNull(), reviewState: RULE_REVIEW_STATE.active },
        });
    }

    // 목록 화면이 쓰는 조회이며, 승인 대기 규칙까지 보여야 사람이 승인할 수 있다.
    async findAllForListing(userId: string, taskId: string): Promise<RuleEntity[]> {
        return this.repo.find({ where: { userId, taskId, deletedAt: IsNull() } });
    }

    async findByAnchor(userId: string, anchorEventId: string): Promise<RuleEntity[]> {
        return this.repo.find({ where: { userId, anchorEventId, deletedAt: IsNull() } });
    }

    async findSignaturesByAnchor(userId: string, anchorEventId: string): Promise<string[]> {
        const rules = await this.findByAnchor(userId, anchorEventId);
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
