/** 원장에서 분리된 이벤트 파티션의 이름과 콜드 스토어 목적지다. */
export interface ArchivedPartition {
    readonly partition: string;
    readonly location: string;
}

/** 원장에서 분리된 만료 파티션을 콜드 스토어로 옮긴다. */
export interface PartitionArchivePort {
    archiveExpiredPartitions(): Promise<readonly ArchivedPartition[]>;
}
