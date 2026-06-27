export interface GetTaskSummaryUseCaseIn {
    readonly taskId: string;
}

export interface TaskSummaryToolCountDto {
    readonly tool: string;
    readonly count: number;
}

export interface TaskSummaryFileDto {
    readonly path: string;
    readonly touches: number;
}

export interface TaskSummaryCommandDto {
    readonly command: string;
    readonly count: number;
}

export interface TaskSummaryUseCaseDto {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly workspacePath?: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly firstUserMessage?: {
        readonly title: string;
        readonly body?: string;
    };
    readonly eventCount: number;
    readonly toolCounts: readonly TaskSummaryToolCountDto[];
    readonly topFiles: readonly TaskSummaryFileDto[];
    readonly topCommands: readonly TaskSummaryCommandDto[];
}

export interface GetTaskSummaryUseCaseOut {
    readonly summary: TaskSummaryUseCaseDto | null;
}
