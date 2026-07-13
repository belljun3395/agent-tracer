import type { ArchivedPartition, PartitionArchivePort } from "../partition.archive.port.js";

/** 파티션 보관 포트의 인메모리 대역이다. */
export class InMemoryPartitionArchive implements PartitionArchivePort {
    private failure: Error | null = null;

    constructor(private detached: ArchivedPartition[] = []) {}

    failWith(error: Error): void {
        this.failure = error;
    }

    remaining(): readonly ArchivedPartition[] {
        return [...this.detached];
    }

    archiveExpiredPartitions(): Promise<readonly ArchivedPartition[]> {
        if (this.failure !== null) return Promise.reject(this.failure);
        const archived = this.detached;
        this.detached = [];
        return Promise.resolve(archived);
    }
}
