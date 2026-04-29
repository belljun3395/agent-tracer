import { Inject, Injectable } from "@nestjs/common";
import { generateUlid } from "./ulid.js";
import { CLOCK_PORT } from "../application/outbound/tokens.js";
import type { IClock } from "../application/outbound/clock.port.js";
import type { IIdGenerator } from "../application/outbound/id.generator.port.js";

@Injectable()
export class CryptoIdGeneratorAdapter implements IIdGenerator {
    constructor(
        @Inject(CLOCK_PORT) private readonly clock: IClock,
    ) {}

    newUuid(): string {
        return globalThis.crypto.randomUUID();
    }

    newUlid(timeMs?: number): string {
        return generateUlid(timeMs ?? this.clock.nowMs());
    }
}
