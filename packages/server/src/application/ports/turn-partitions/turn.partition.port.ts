import type { TurnPartitionRecordPortDto } from "./dto/turn.partition.record.port.dto.js";

export interface TurnPartitionPort {
    get(taskId: string): Promise<TurnPartitionRecordPortDto | null>;
    upsert(partition: TurnPartitionRecordPortDto): Promise<void>;
    delete(taskId: string): Promise<void>;
}
