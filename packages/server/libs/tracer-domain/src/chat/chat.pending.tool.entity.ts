import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { CHAT_PENDING_TOOL_STATUS, type ChatPendingToolStatus } from "./chat.const.js";
import { InvariantViolationError } from "../error/invariant.error.js";

export interface ChatPendingToolCreateInput {
    readonly id: string;
    readonly threadId: string;
    /** 이 도구를 제안한 어시스턴트 메시지이며, 없으면 null이다. */
    readonly messageId: string | null;
    readonly toolName: string;
    readonly args: Record<string, unknown>;
    readonly now: Date;
}

// 승인 대기 화면이 스레드별 대기 목록을 훑으므로 (thread_id, status) 복합 인덱스를 둔다.
@Entity({ name: "chat_pending_tools" })
@Index("chat_pending_tools_thread_status", ["threadId", "status"])
export class ChatPendingToolEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "thread_id", type: "text" })
    threadId!: string;

    @Column({ name: "message_id", type: "text", nullable: true })
    messageId!: string | null;

    @Column({ name: "tool_name", type: "text" })
    toolName!: string;

    @Column({ type: "jsonb", default: {} })
    args!: Record<string, unknown>;

    @Column({ type: "text", default: CHAT_PENDING_TOOL_STATUS.pending })
    status!: ChatPendingToolStatus;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "resolved_at", type: "timestamptz", nullable: true })
    resolvedAt!: Date | null;

    static create(input: ChatPendingToolCreateInput): ChatPendingToolEntity {
        const pending = new ChatPendingToolEntity();
        pending.id = input.id;
        pending.threadId = input.threadId;
        pending.messageId = input.messageId;
        pending.toolName = input.toolName;
        pending.args = input.args;
        pending.status = CHAT_PENDING_TOOL_STATUS.pending;
        pending.createdAt = input.now;
        pending.resolvedAt = null;
        return pending;
    }

    approve(now: Date): void {
        this.resolve(CHAT_PENDING_TOOL_STATUS.approved, now);
    }

    reject(now: Date): void {
        this.resolve(CHAT_PENDING_TOOL_STATUS.rejected, now);
    }

    isPending(): boolean {
        return this.status === CHAT_PENDING_TOOL_STATUS.pending;
    }

    private resolve(status: ChatPendingToolStatus, now: Date): void {
        if (!this.isPending()) throw new InvariantViolationError("chat-pending-tool.already-resolved");
        this.status = status;
        this.resolvedAt = now;
    }
}
