import type { AiJobStepReaperStepRepository } from "~projector/domain/recover/port/ai.job.step.reaper.repository.port.js";

/** 잡 스텝 회수 저장소 포트의 인메모리 대역이다. */
export class InMemoryAiJobStepRepository implements AiJobStepReaperStepRepository {
    private rows: Date[] = [];
    readonly deleteCalls: { readonly cutoff: Date; readonly limit: number }[] = [];

    seed(...createdAt: readonly Date[]): void {
        this.rows.push(...createdAt);
    }

    remaining(): number {
        return this.rows.length;
    }

    deleteOlderThan(cutoff: Date, limit: number): Promise<number> {
        this.deleteCalls.push({ cutoff, limit });
        const doomed = this.rows.filter((createdAt) => createdAt.getTime() < cutoff.getTime()).slice(0, limit);
        this.rows = this.rows.filter((createdAt) => !doomed.includes(createdAt));
        return Promise.resolve(doomed.length);
    }
}
