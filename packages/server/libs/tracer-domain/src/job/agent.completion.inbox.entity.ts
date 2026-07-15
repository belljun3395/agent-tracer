import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export const COMPLETION_INBOX_STATUS = {
    pending: "pending",
    completed: "completed",
    canceled: "canceled",
    expired: "expired",
} as const;

export type CompletionInboxStatus = (typeof COMPLETION_INBOX_STATUS)[keyof typeof COMPLETION_INBOX_STATUS];

/** 분리된 에이전트 실행의 완료 결과를 worker 수명과 독립적으로 보관한다. */
@Entity({ name: "agent_completion_inbox" })
@Index("agent_completion_inbox_expiry", ["expiresAt"], {
    where: "\"status\" = 'pending'",
})
export class AgentCompletionInboxEntity {
    // agent와 실행 식별자를 합친 자연키로 Temporal activity 재시도가 같은 창구를 재사용한다.
    @PrimaryColumn({ name: "run_key", type: "text" })
    runKey!: string;

    // 원문 토큰은 callback 요청에만 존재하며, DB 유출로 완료 권한이 재사용되지 않도록 해시만 저장한다.
    @Column({ name: "token_hash", type: "text", unique: true })
    tokenHash!: string;

    @Column({ type: "text" })
    status!: CompletionInboxStatus;

    @Column({ type: "jsonb", nullable: true })
    response!: Record<string, unknown> | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "expires_at", type: "timestamptz" })
    expiresAt!: Date;

    @Column({ name: "completed_at", type: "timestamptz", nullable: true })
    completedAt!: Date | null;

    static open(runKey: string, tokenHash: string, now: Date, expiresAt: Date): AgentCompletionInboxEntity {
        const inbox = new AgentCompletionInboxEntity();
        inbox.runKey = runKey;
        inbox.tokenHash = tokenHash;
        inbox.status = COMPLETION_INBOX_STATUS.pending;
        inbox.response = null;
        inbox.createdAt = now;
        inbox.expiresAt = expiresAt;
        inbox.completedAt = null;
        return inbox;
    }
}
