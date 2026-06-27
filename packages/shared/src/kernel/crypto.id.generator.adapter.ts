import { Inject, Injectable } from "@nestjs/common";
import { CLOCK_PORT } from "./clock.js";
import type { IClock, IIdGenerator } from "./clock.js";
import { generateUlid } from "./ulid.js";

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
