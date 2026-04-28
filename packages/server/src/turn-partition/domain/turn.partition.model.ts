import type { TimelineEvent } from "~event/domain/model/timeline.event.model.js";

export interface TurnGroup {
    readonly id: string;
    readonly from: number;
    readonly to: number;
    readonly label: string | null;
    readonly visible: boolean;
}

export interface TurnPartition {
    readonly taskId: string;
    readonly groups: readonly TurnGroup[];
    readonly version: number;
    readonly updatedAt: string;
}

export interface ResolveTurnPartitionInput {
    readonly taskId: string;
    readonly stored: TurnPartition | null;
    readonly events: readonly TimelineEvent[];
    readonly fallbackUpdatedAt: string;
}

export interface TurnPartitionUpdateInput {
    readonly taskId: string;
    readonly groups: readonly TurnGroup[];
    readonly existing: TurnPartition | null;
    readonly updatedAt: string;
}
