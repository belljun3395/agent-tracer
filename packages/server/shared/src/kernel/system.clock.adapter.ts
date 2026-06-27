import { Injectable } from "@nestjs/common";
import type { IClock } from "./clock.js";

@Injectable()
export class SystemClockAdapter implements IClock {
    nowMs(): number {
        return Date.now();
    }

    nowIso(): string {
        return new Date().toISOString();
    }
}
