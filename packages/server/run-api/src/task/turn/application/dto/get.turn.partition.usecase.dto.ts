import type { TurnPartition } from "../../domain/turn.partition.model.js";

export interface GetTurnPartitionUseCaseIn { readonly taskId: string }
export type GetTurnPartitionUseCaseOut = TurnPartition;
