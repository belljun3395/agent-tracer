import type {ClockPort} from "~runtime/domain/ingest/port/clock.port.js";

export class FixedClock implements ClockPort {
    constructor(private current: number) {}

    now(): number {
        return this.current;
    }

    advance(ms: number): void {
        this.current += ms;
    }
}
