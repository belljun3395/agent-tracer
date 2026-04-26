import type { TurnPartitionRecordPortDto } from "~application/ports/turn-partitions/dto/turn.partition.record.port.dto.js";
import type { TurnPartitionPort } from "~application/ports/turn-partitions/turn.partition.port.js";

export type TurnPartition = TurnPartitionRecordPortDto;

export type ITurnPartitionRepository = TurnPartitionPort;
