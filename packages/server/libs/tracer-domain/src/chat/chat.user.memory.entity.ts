import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export interface ChatUserMemoryCreateInput {
    readonly id: string;
    readonly userId: string;
    /** 안정된 슬러그이며, 같은 사용자 안에서 재작성 대상을 찾는 키다. */
    readonly key: string;
    readonly content: string;
    readonly now: Date;
}

// 같은 사용자·같은 키의 기억은 하나뿐이라 유니크 인덱스로 강제한다.
@Entity({ name: "chat_user_memories" })
@Index("chat_user_memories_unique", ["userId", "key"], { unique: true })
export class ChatUserMemoryEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "text" })
    key!: string;

    @Column({ type: "text" })
    content!: string;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;

    static create(input: ChatUserMemoryCreateInput): ChatUserMemoryEntity {
        const memory = new ChatUserMemoryEntity();
        memory.id = input.id;
        memory.userId = input.userId;
        memory.key = input.key;
        memory.content = input.content;
        memory.createdAt = input.now;
        memory.updatedAt = input.now;
        return memory;
    }

    updateContent(content: string, now: Date): void {
        this.content = content;
        this.updatedAt = now;
    }
}
