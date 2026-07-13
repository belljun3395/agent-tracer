import { KIND } from "@monitor/kernel";
import type { EventEntity } from "@monitor/tracer-domain";
import type { EventReaderPort } from "~tracer-api/domain/task/port/event.reader.port.js";

/** 이벤트 조회 포트의 인메모리 대역이다. */
export class InMemoryEventReader implements EventReaderPort {
    private readonly rows: EventEntity[] = [];

    seed(...events: readonly EventEntity[]): void {
        this.rows.push(...events);
    }

    all(): readonly EventEntity[] {
        return [...this.rows];
    }

    findTimeline(taskId: string, cursor: { seq: string } | undefined, limit: number): Promise<EventEntity[]> {
        const rows = this.ordered(taskId).filter((event) => cursor === undefined || event.seq > cursor.seq);
        return Promise.resolve(rows.slice(0, limit));
    }

    findUserMessagesByTask(taskId: string): Promise<EventEntity[]> {
        return Promise.resolve(this.ordered(taskId).filter((event) => event.kind === KIND.userMessage));
    }

    private ordered(taskId: string): EventEntity[] {
        return this.rows.filter((event) => event.taskId === taskId).sort((a, b) => a.seq.localeCompare(b.seq));
    }
}
