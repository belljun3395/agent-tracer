import type { IngestKeyRetentionPort } from "~runtime-api/domain/cold/port/ingest.key.retention.port.js";
import type {
    ArchivedPartition,
    PartitionArchivePort,
} from "~runtime-api/domain/cold/port/partition.archive.port.js";

/** 콜드 티어 1회 실행이 원장에서 걷어낸 결과다. */
export interface ColdTierRun {
    readonly archived: readonly ArchivedPartition[];
    readonly prunedIngestKeys: number;
}

/** 만료 파티션 보관과 수집 키 보존 정책을 한 번 집행한다. */
export class RunColdTierUsecase {
    constructor(
        private readonly archive: PartitionArchivePort,
        private readonly retention: IngestKeyRetentionPort,
    ) {}

    async execute(): Promise<ColdTierRun> {
        const archived = await this.archive.archiveExpiredPartitions();
        const prunedIngestKeys = await this.retention.deleteExpiredIngestKeys();
        return { archived, prunedIngestKeys };
    }
}
