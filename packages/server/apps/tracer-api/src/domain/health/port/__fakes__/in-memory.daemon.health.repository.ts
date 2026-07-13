import type { DaemonHealthEntity } from "@monitor/tracer-domain";
import type { DaemonHealthRepositoryPort } from "~tracer-api/domain/health/port/daemon-health.repository.port.js";

/** 데몬 건강 포트의 인메모리 대역이다. */
export class InMemoryDaemonHealthRepository implements DaemonHealthRepositoryPort {
    private readonly rows = new Map<string, DaemonHealthEntity>();

    seed(...entities: readonly DaemonHealthEntity[]): void {
        for (const entity of entities) this.rows.set(entity.userId, entity);
    }

    all(): readonly DaemonHealthEntity[] {
        return [...this.rows.values()];
    }

    findByUser(userId: string): Promise<DaemonHealthEntity | null> {
        return Promise.resolve(this.rows.get(userId) ?? null);
    }

    upsert(entity: DaemonHealthEntity): Promise<void> {
        this.rows.set(entity.userId, entity);
        return Promise.resolve();
    }
}
