import type { TurnEntity } from "@monitor/tracer-domain";
import type { TurnRepositoryPort } from "../turn.repository.port.js";

/** 턴 저장소 포트의 인메모리 대역이다. */
export class InMemoryTurnRepository implements TurnRepositoryPort {
    private readonly rows = new Map<string, TurnEntity>();

    seed(...turns: readonly TurnEntity[]): void {
        for (const turn of turns) this.rows.set(turn.id, turn);
    }

    all(): TurnEntity[] {
        return [...this.rows.values()];
    }

    findById(id: string): Promise<TurnEntity | null> {
        return Promise.resolve(this.rows.get(id) ?? null);
    }

    findByTask(taskId: string): Promise<TurnEntity[]> {
        return Promise.resolve(this.all().filter((turn) => turn.taskId === taskId));
    }

    upsert(turn: TurnEntity): Promise<void> {
        this.rows.set(turn.id, turn);
        return Promise.resolve();
    }
}
