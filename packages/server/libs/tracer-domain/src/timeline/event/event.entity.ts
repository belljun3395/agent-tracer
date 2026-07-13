import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { KIND, type EventKind, type EventLane } from "@monitor/kernel";
import { ASYNC_ACTION_STATUS, META } from "./event.const.js";

@Entity({ name: "events" })
@Index("events_task_seq", ["taskId", "seq"])
@Index("events_turn", ["turnId"])
@Index("events_trace", ["traceId"])
export class EventEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "seq", type: "bigint" })
    seq!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ name: "session_id", type: "text", nullable: true })
    sessionId!: string | null;

    @Column({ name: "turn_id", type: "text", nullable: true })
    turnId!: string | null;

    @Column({ type: "text" })
    kind!: EventKind;

    @Column({ type: "text" })
    lane!: EventLane;

    @Column({ type: "text", default: "" })
    title!: string;

    @Column({ type: "text", nullable: true })
    body!: string | null;

    @Column({ name: "tool_name", type: "text", nullable: true })
    toolName!: string | null;

    @Column({ name: "file_paths", type: "jsonb", default: [] })
    filePaths!: string[];

    @Column({ type: "jsonb", default: {} })
    metadata!: Record<string, unknown>;

    // 원장에서 확정된 OTLP 식별자이며 읽기 모델은 그대로 실어 나른다.
    @Column({ name: "trace_id", type: "text" })
    traceId!: string;

    @Column({ name: "span_id", type: "text" })
    spanId!: string;

    @Column({ name: "parent_span_id", type: "text", nullable: true })
    parentSpanId!: string | null;

    @Column({ name: "occurred_at", type: "timestamptz" })
    occurredAt!: Date;

    isUserMessage(): boolean {
        return this.kind === KIND.userMessage;
    }

    isAssistantResponse(): boolean {
        return this.kind === KIND.assistantResponse;
    }

    isAssistantCommentary(): boolean {
        return this.kind === KIND.assistantCommentary;
    }

    turnResponseEventId(): string | null {
        const value = this.metadata[META.turnResponseEventId];
        return typeof value === "string" && value.length > 0 ? value : null;
    }

    // 서브에이전트 위임처럼 시작~종료 사이 다른 턴을 거칠 수 있는 비동기 작업의 상관키이며, action.logged 이외 종류나 상관키가 없는 이벤트는 상관 대상이 아니다.
    asyncTaskId(): string | null {
        if (this.kind !== KIND.actionLogged) return null;
        const value = this.metadata[META.asyncTaskId];
        return typeof value === "string" && value.length > 0 ? value : null;
    }

    isAsyncActionRunning(): boolean {
        return this.kind === KIND.actionLogged && this.metadata[META.asyncStatus] === ASYNC_ACTION_STATUS.running;
    }

    attachToTurn(turnId: string): void {
        this.turnId = turnId;
    }
}
