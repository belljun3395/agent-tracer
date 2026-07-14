import type {SchedulerPort} from "~runtime/domain/rulegen/port/scheduler.port.js";

export class ManualScheduler implements SchedulerPort {
    private readonly runs: Array<() => void> = [];

    every(_intervalMs: number, run: () => void): () => void {
        this.runs.push(run);
        return () => {
            const index = this.runs.indexOf(run);
            if (index >= 0) this.runs.splice(index, 1);
        };
    }

    get pending(): number {
        return this.runs.length;
    }

    tick(): void {
        for (const run of [...this.runs]) run();
    }
}
