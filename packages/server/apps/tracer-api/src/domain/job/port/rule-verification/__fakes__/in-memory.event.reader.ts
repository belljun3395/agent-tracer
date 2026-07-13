import type { EventEntity } from "@monitor/tracer-domain";
import type { EventReaderPort } from "~tracer-api/domain/job/port/rule-verification/event.reader.port.js";

/** 이벤트 조회 포트의 인메모리 대역이다. */
export class InMemoryEventReader implements EventReaderPort {
    private readonly rows = new Map<string, EventEntity>();

    seed(...events: readonly EventEntity[]): void {
        for (const event of events) this.rows.set(event.id, event);
    }

    all(): EventEntity[] {
        return this.ordered();
    }

    findByIds(ids: readonly string[]): Promise<EventEntity[]> {
        return Promise.resolve(this.ordered().filter((event) => ids.includes(event.id)));
    }

    findByTurn(turnId: string): Promise<EventEntity[]> {
        return Promise.resolve(this.ordered().filter((event) => event.turnId === turnId));
    }

    findByTaskSinceEvent(taskId: string, anchorEventId: string): Promise<EventEntity[]> {
        const anchor = this.rows.get(anchorEventId);
        if (anchor === undefined) return Promise.resolve([]);
        const events = this.ordered().filter(
            (event) => event.taskId === taskId && BigInt(event.seq) >= BigInt(anchor.seq),
        );
        return Promise.resolve(events);
    }

    private ordered(): EventEntity[] {
        return [...this.rows.values()].sort((a, b) => (BigInt(a.seq) < BigInt(b.seq) ? -1 : 1));
    }
}
