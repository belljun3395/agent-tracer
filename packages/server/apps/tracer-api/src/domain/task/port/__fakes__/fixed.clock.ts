import type { ClockPort } from "~tracer-api/domain/task/port/clock.port.js";

export class FixedClock implements ClockPort {
    constructor(private current: Date) {}

    now(): Date {
        return this.current;
    }

    nowMs(): number {
        return this.current.getTime();
    }

    nowIso(): string {
        return this.current.toISOString();
    }

    advance(ms: number): void {
        this.current = new Date(this.current.getTime() + ms);
    }
}
