import type { TurnPartition } from "~domain/turn-partitions/index.js";

export type { TurnPartition };

export interface ITurnPartitionRepository {
    get(taskId: string): Promise<TurnPartition | null>;
    upsert(partition: TurnPartition): Promise<void>;
    delete(taskId: string): Promise<void>;
}
