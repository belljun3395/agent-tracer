import type {IdGeneratorPort} from "~runtime/domain/ingest/port/id.generator.port.js";

export class SequentialIdGenerator implements IdGeneratorPort {
    private issued = 0;

    next(): string {
        this.issued += 1;
        return `id-${this.issued}`;
    }
}
