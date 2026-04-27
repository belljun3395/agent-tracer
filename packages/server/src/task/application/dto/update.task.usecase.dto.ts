export type UpdateTaskStatusUseCaseDto = "running" | "waiting" | "completed" | "errored";
export type UpdateTaskKindUseCaseDto = "primary" | "background";

export interface UpdateTaskUseCaseIn {
    readonly taskId: string;
    readonly title?: string;
    readonly status?: UpdateTaskStatusUseCaseDto;
}

export interface UpdateTaskTaskUseCaseDto {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly displayTitle?: string;
    readonly workspacePath?: string;
    readonly status: UpdateTaskStatusUseCaseDto;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastSessionStartedAt?: string;
    readonly runtimeSource?: string;
    readonly taskKind?: UpdateTaskKindUseCaseDto;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
}

export type UpdateTaskUseCaseOut = UpdateTaskTaskUseCaseDto | null;
