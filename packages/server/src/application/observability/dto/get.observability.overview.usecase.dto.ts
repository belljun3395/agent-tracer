export type GetObservabilityOverviewUseCaseIn = Record<string, never>;

export interface ObservabilityRuntimeSourceUseCaseDto {
    readonly runtimeSource: string;
    readonly taskCount: number;
    readonly runningTaskCount: number;
    readonly promptCaptureRate: number;
    readonly traceLinkedTaskRate: number;
}

export interface ObservabilityOverviewUseCaseDto {
    readonly generatedAt: string;
    readonly totalTasks: number;
    readonly runningTasks: number;
    readonly staleRunningTasks: number;
    readonly avgDurationMs: number;
    readonly avgEventsPerTask: number;
    readonly promptCaptureRate: number;
    readonly traceLinkedTaskRate: number;
    readonly tasksWithQuestions: number;
    readonly tasksWithTodos: number;
    readonly tasksWithCoordination: number;
    readonly tasksWithBackground: number;
    readonly tasksAwaitingApproval: number;
    readonly tasksBlockedByRule: number;
    readonly runtimeSources: readonly ObservabilityRuntimeSourceUseCaseDto[];
}

export interface GetObservabilityOverviewUseCaseOut {
    readonly observability: ObservabilityOverviewUseCaseDto;
}
