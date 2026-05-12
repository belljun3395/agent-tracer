export interface GetTaskUseCaseIn {
    readonly taskId: string;
}

export type GetTaskStatusUseCaseDto = "running" | "waiting" | "completed" | "errored";
export type GetTaskKindUseCaseDto = "primary" | "background";
export type GetTaskOriginUseCaseDto = "user" | "server-sdk";

export interface GetTaskTaskUseCaseDto {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly displayTitle?: string;
    readonly workspacePath?: string;
    readonly status: GetTaskStatusUseCaseDto;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastSessionStartedAt?: string;
    readonly runtimeSource?: string;
    readonly taskKind?: GetTaskKindUseCaseDto;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
    readonly origin?: GetTaskOriginUseCaseDto;
}

export interface GetTaskUseCaseOut {
    readonly task: GetTaskTaskUseCaseDto | null;
}
