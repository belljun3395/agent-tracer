export type ListTasksArchivedScope = "active" | "archived" | "all";
export type ListTasksOriginFilter = "user" | "server-sdk" | "all";

export interface ListTasksUseCaseIn {
    readonly archived?: ListTasksArchivedScope;
    readonly origin?: ListTasksOriginFilter;
}

export type ListTasksTaskStatusUseCaseDto = "running" | "waiting" | "completed" | "errored";
export type ListTasksTaskKindUseCaseDto = "primary" | "background";
export type ListTasksTaskOriginUseCaseDto = "user" | "server-sdk";

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
    readonly archivedAt?: string;
    readonly origin?: ListTasksTaskOriginUseCaseDto;
}

export interface ListTasksUseCaseOut {
    readonly tasks: readonly ListTasksTaskUseCaseDto[];
}
