import { Injectable } from "@nestjs/common";
import type { IClock } from "../application/outbound/clock.port.js";

@Injectable()
export class SystemClockAdapter implements IClock {
    nowMs(): number {
        return Date.now();
    }

    nowIso(): string {
        return new Date().toISOString();
    }
}
