export interface TurnGroupUseCaseDto {
    readonly id: string;
    readonly from: number;
    readonly to: number;
    readonly label: string | null;
    readonly visible: boolean;
}
export interface UpsertTurnPartitionUseCaseIn {
    readonly taskId: string;
    readonly groups: readonly TurnGroupUseCaseDto[];
    readonly baseVersion?: number;
}
export type UpsertTurnPartitionUseCaseOut = unknown;
