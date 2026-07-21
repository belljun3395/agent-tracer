import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { CHAT_MESSAGE_ROLE, type ChatMessageRole } from "./chat.const.js";

// 어시스턴트 메시지가 제안하는 도구 호출 한 건이며, args는 모델이 낸 원본 인자다.
export interface ChatToolCall {
    readonly id: string;
    readonly name: string;
    readonly args: Record<string, unknown>;
}

export interface ChatMessageCreateInput {
    readonly id: string;
    readonly threadId: string;
    readonly role: ChatMessageRole;
    readonly content: string;
    readonly toolCalls?: readonly ChatToolCall[];
    readonly toolCallId?: string;
    readonly now: Date;
}

// 재생(replay)이 스레드 안 순서를 그대로 복원해야 하므로 (thread_id, created_at) 인덱스를 둔다.
@Entity({ name: "chat_messages" })
@Index("chat_messages_thread_created", ["threadId", "createdAt"])
export class ChatMessageEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "thread_id", type: "text" })
    threadId!: string;

    @Column({ type: "text" })
    role!: ChatMessageRole;

    @Column({ type: "text" })
    content!: string;

    // 어시스턴트가 도구 호출을 제안한 턴에만 값이 있고, 그 외 역할에는 null이다.
    @Column({ name: "tool_calls", type: "jsonb", nullable: true })
    toolCalls!: readonly ChatToolCall[] | null;

    // role이 tool일 때 어느 호출의 결과인지를 잇는 식별자이며, 그 외 역할에는 null이다.
    @Column({ name: "tool_call_id", type: "text", nullable: true })
    toolCallId!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    static create(input: ChatMessageCreateInput): ChatMessageEntity {
        const message = new ChatMessageEntity();
        message.id = input.id;
        message.threadId = input.threadId;
        message.role = input.role;
        message.content = input.content;
        message.toolCalls = input.toolCalls && input.toolCalls.length > 0 ? [...input.toolCalls] : null;
        message.toolCallId = input.toolCallId ?? null;
        message.createdAt = input.now;
        return message;
    }

    isFromTool(): boolean {
        return this.role === CHAT_MESSAGE_ROLE.tool;
    }

    proposesToolCall(): boolean {
        return this.role === CHAT_MESSAGE_ROLE.assistant && (this.toolCalls?.length ?? 0) > 0;
    }
}
