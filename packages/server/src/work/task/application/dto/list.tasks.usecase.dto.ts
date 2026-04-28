export type ListTasksUseCaseIn = Record<string, never>;

export type ListTasksTaskStatusUseCaseDto = "running" | "waiting" | "completed" | "errored";
export type ListTasksTaskKindUseCaseDto = "primary" | "background";

export interface ListTasksTaskUseCaseDto {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly displayTitle?: string;
    readonly workspacePath?: string;
    readonly status: ListTasksTaskStatusUseCaseDto;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastSessionStartedAt?: string;
    readonly runtimeSource?: string;
    readonly taskKind?: ListTasksTaskKindUseCaseDto;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
}

export interface ListTasksUseCaseOut {
    readonly tasks: readonly ListTasksTaskUseCaseDto[];
}
