import type { QueryDeepPartialEntity, Repository } from "typeorm";
import { COMPLETION_INBOX_STATUS, type AgentCompletionInboxEntity } from "./agent.completion.inbox.entity.js";

export type CompletionAcceptance = "accepted" | "duplicate" | "closed" | "unknown";

/** 완료 결과의 단일 수락과 취소·만료 경합을 DB 조건부 갱신으로 결정한다. */
export class AgentCompletionInboxRepository {
    constructor(private readonly repo: Repository<AgentCompletionInboxEntity>) {}

    async findByRunKey(runKey: string): Promise<AgentCompletionInboxEntity | null> {
        return this.repo.findOne({ where: { runKey } });
    }

    async insert(inbox: AgentCompletionInboxEntity): Promise<boolean> {
        const result = await this.repo
            .createQueryBuilder()
            .insert()
            .into(this.repo.target)
            .values(inbox as unknown as QueryDeepPartialEntity<AgentCompletionInboxEntity>)
            .orIgnore()
            .execute();
        return result.identifiers.length > 0;
    }

    async accept(tokenHash: string, response: Record<string, unknown>, now: Date): Promise<CompletionAcceptance> {
        const accepted = await this.repo
            .createQueryBuilder()
            .update()
            .set({
                status: COMPLETION_INBOX_STATUS.completed,
                response,
                completedAt: now,
            } as unknown as QueryDeepPartialEntity<AgentCompletionInboxEntity>)
            .where("token_hash = :tokenHash", { tokenHash })
            .andWhere("status = :pending", { pending: COMPLETION_INBOX_STATUS.pending })
            .andWhere("expires_at > :now", { now })
            .execute();
        if ((accepted.affected ?? 0) > 0) return "accepted";

        const inbox = await this.repo.findOne({ where: { tokenHash } });
        if (inbox === null) return "unknown";
        if (inbox.status === COMPLETION_INBOX_STATUS.completed) return "duplicate";
        return "closed";
    }

    async closePending(runKey: string, status: "canceled" | "expired", now: Date): Promise<boolean> {
        const result = await this.repo
            .createQueryBuilder()
            .update()
            .set({ status, completedAt: now })
            .where("run_key = :runKey", { runKey })
            .andWhere("status = :pending", { pending: COMPLETION_INBOX_STATUS.pending })
            .execute();
        return (result.affected ?? 0) > 0;
    }
}
