import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { generateUlid } from "@monitor/platform";
import { InvariantViolationError } from "../error/invariant.error.js";
import {
    CHAT_EXECUTION_STATUS,
    type ChatBackend,
    type ChatExecutionStatus,
} from "./chat.const.js";

export interface ChatExecutionCreateInput {
    readonly userId: string;
    readonly threadId: string;
    readonly userMessageId: string;
    readonly clientRequestId: string;
    readonly inputHash: string;
    readonly requestedBackend: ChatBackend | null;
    readonly model: string | null;
    readonly language: string | null;
    readonly now: Date;
}

@Entity({ name: "chat_executions" })
@Index("chat_executions_thread_created", ["threadId", "createdAt"])
@Index("chat_executions_user_status_updated", ["userId", "status", "updatedAt"])
@Index("chat_executions_running_thread", ["threadId"], {
    unique: true,
    where: `"status" = 'running'`,
})
@Index("chat_executions_idempotency", ["userId", "threadId", "clientRequestId"], {
    unique: true,
})
export class ChatExecutionEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ name: "thread_id", type: "text" })
    threadId!: string;

    @Column({ name: "user_message_id", type: "text" })
    userMessageId!: string;

    @Column({ name: "client_request_id", type: "text" })
    clientRequestId!: string;

    @Column({ name: "input_hash", type: "text" })
    inputHash!: string;

    @Column({ type: "text" })
    status!: ChatExecutionStatus;

    @Column({ name: "requested_backend", type: "text", nullable: true })
    requestedBackend!: ChatBackend | null;

    @Column({ type: "text", nullable: true })
    model!: string | null;

    @Column({ type: "text", nullable: true })
    language!: string | null;

    @Column({ name: "draft_text", type: "text", default: "" })
    draftText!: string;

    @Column({ name: "draft_seq", type: "integer", default: 0 })
    draftSeq!: number;

    @Column({ name: "assistant_message_id", type: "text", nullable: true })
    assistantMessageId!: string | null;

    @Column({ type: "text", nullable: true })
    error!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;

    @Column({ name: "started_at", type: "timestamptz", nullable: true })
    startedAt!: Date | null;

    @Column({ name: "completed_at", type: "timestamptz", nullable: true })
    completedAt!: Date | null;

    static create(input: ChatExecutionCreateInput): ChatExecutionEntity {
        const execution = new ChatExecutionEntity();
        execution.id = generateUlid(input.now.getTime());
        execution.userId = input.userId;
        execution.threadId = input.threadId;
        execution.userMessageId = input.userMessageId;
        execution.clientRequestId = input.clientRequestId;
        execution.inputHash = input.inputHash;
        execution.status = CHAT_EXECUTION_STATUS.queued;
        execution.requestedBackend = input.requestedBackend;
        execution.model = input.model;
        execution.language = input.language;
        execution.draftText = "";
        execution.draftSeq = 0;
        execution.assistantMessageId = null;
        execution.error = null;
        execution.createdAt = input.now;
        execution.updatedAt = input.now;
        execution.startedAt = null;
        execution.completedAt = null;
        return execution;
    }

    start(now: Date): void {
        if (this.status !== CHAT_EXECUTION_STATUS.queued) {
            throw new InvariantViolationError("chat-execution.not-queued");
        }
        this.status = CHAT_EXECUTION_STATUS.running;
        this.startedAt = now;
        this.updatedAt = now;
    }

    recover(now: Date): void {
        if (this.status !== CHAT_EXECUTION_STATUS.running) {
            throw new InvariantViolationError("chat-execution.not-running");
        }
        this.status = CHAT_EXECUTION_STATUS.queued;
        this.startedAt = null;
        this.updatedAt = now;
    }

    checkpoint(draftText: string, seq: number, now: Date): void {
        if (this.status !== CHAT_EXECUTION_STATUS.running) {
            throw new InvariantViolationError("chat-execution.not-running");
        }
        if (seq <= this.draftSeq) return;
        this.draftText = draftText;
        this.draftSeq = seq;
        this.updatedAt = now;
    }

    complete(assistantMessageId: string, now: Date): void {
        if (this.status !== CHAT_EXECUTION_STATUS.running) {
            throw new InvariantViolationError("chat-execution.not-running");
        }
        this.status = CHAT_EXECUTION_STATUS.completed;
        this.assistantMessageId = assistantMessageId;
        this.completedAt = now;
        this.updatedAt = now;
    }

    fail(error: string, now: Date): void {
        this.assertCancelable();
        this.status = CHAT_EXECUTION_STATUS.failed;
        this.error = error;
        this.completedAt = now;
        this.updatedAt = now;
    }

    cancel(now: Date): void {
        this.assertCancelable();
        this.status = CHAT_EXECUTION_STATUS.canceled;
        this.completedAt = now;
        this.updatedAt = now;
    }

    isTerminal(): boolean {
        return (
            this.status === CHAT_EXECUTION_STATUS.completed ||
            this.status === CHAT_EXECUTION_STATUS.failed ||
            this.status === CHAT_EXECUTION_STATUS.canceled
        );
    }

    private assertCancelable(): void {
        if (this.isTerminal()) throw new InvariantViolationError("chat-execution.already-terminal");
    }
}
