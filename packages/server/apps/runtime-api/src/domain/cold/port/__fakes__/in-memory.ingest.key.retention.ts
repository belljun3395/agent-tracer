import type { IngestKeyRetentionPort } from "../ingest.key.retention.port.js";

/** 수집 키 보존 포트의 인메모리 대역이다. */
export class InMemoryIngestKeyRetention implements IngestKeyRetentionPort {
    private calls = 0;

    constructor(private expired: string[] = []) {}

    callCount(): number {
        return this.calls;
    }

    remaining(): readonly string[] {
        return [...this.expired];
    }

    deleteExpiredIngestKeys(): Promise<number> {
        this.calls += 1;
        const deleted = this.expired.length;
        this.expired = [];
        return Promise.resolve(deleted);
    }
}
