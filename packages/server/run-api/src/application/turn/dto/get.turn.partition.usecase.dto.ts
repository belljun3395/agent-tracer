import type { TurnPartition } from "../../../domain/turn/type/turn.partition.type.js";

export interface GetTurnPartitionUseCaseIn { readonly taskId: string }
export type GetTurnPartitionUseCaseOut = TurnPartition;
