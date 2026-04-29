import { Injectable } from "@nestjs/common";
import type { IIdGenerator } from "../application/outbound/id.generator.port.js";

@Injectable()
export class CryptoIdGeneratorAdapter implements IIdGenerator {
    newUuid(): string {
        return globalThis.crypto.randomUUID();
    }
}
