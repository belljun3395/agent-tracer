import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { CHAT_BACKEND, type ChatBackend } from "./chat.const.js";

export interface ChatThreadCreateInput {
    readonly id: string;
    readonly userId: string;
    readonly title: string;
    readonly now: Date;
}

// 사용자 목록 화면이 최신 대화부터 훑으므로 (user_id, updated_at) 복합 인덱스를 둔다.
@Entity({ name: "chat_threads" })
@Index("chat_threads_user_updated", ["userId", "updatedAt"])
export class ChatThreadEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "text" })
    title!: string;

    @Column({ type: "text", nullable: true })
    summary!: string | null;

    // 이 스레드에서 마지막으로 턴을 실행한 백엔드이며, 첫 턴 전에는 아직 없어 null이다.
    @Column({ type: "text", nullable: true })
    backend!: ChatBackend | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;

    static create(input: ChatThreadCreateInput): ChatThreadEntity {
        const thread = new ChatThreadEntity();
        thread.id = input.id;
        thread.userId = input.userId;
        thread.title = input.title;
        thread.summary = null;
        thread.backend = null;
        thread.createdAt = input.now;
        thread.updatedAt = input.now;
        return thread;
    }

    rename(title: string, now: Date): void {
        this.title = title;
        this.updatedAt = now;
    }

    updateSummary(summary: string | null, now: Date): void {
        this.summary = summary;
        this.updatedAt = now;
    }

    // 턴이 끝날 때마다 어느 백엔드가 그 턴을 실행했는지 기록하고 목록 정렬 기준인 updated_at을 민다.
    recordTurn(backend: ChatBackend, now: Date): void {
        this.backend = backend;
        this.updatedAt = now;
    }

    ranOnClaudeSdk(): boolean {
        return this.backend === CHAT_BACKEND.claudeSdk;
    }
}
