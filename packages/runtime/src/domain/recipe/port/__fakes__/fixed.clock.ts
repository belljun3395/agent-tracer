import type {ClockPort} from "~runtime/domain/recipe/port/clock.port.js";

export class FixedClock implements ClockPort {
    constructor(private current: number) {}

    now(): number {
        return this.current;
    }
}
