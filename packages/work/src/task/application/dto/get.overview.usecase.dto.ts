export type GetOverviewUseCaseIn = Record<string, never>;

export interface GetOverviewUseCaseOut {
    readonly totalTasks: number;
    readonly runningTasks: number;
    readonly waitingTasks: number;
    readonly completedTasks: number;
    readonly erroredTasks: number;
    readonly totalEvents: number;
}
