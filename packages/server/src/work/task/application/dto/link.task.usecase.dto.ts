export type LinkTaskKindUseCaseDto = "primary" | "background";

export interface LinkTaskUseCaseIn {
    readonly taskId: string;
    readonly title?: string;
    readonly taskKind?: LinkTaskKindUseCaseDto;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
}

export type LinkTaskStatusUseCaseDto = "running" | "waiting" | "completed" | "errored";

export interface LinkTaskUseCaseOut {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly displayTitle?: string;
    readonly workspacePath?: string;
    readonly status: LinkTaskStatusUseCaseDto;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastSessionStartedAt?: string;
    readonly runtimeSource?: string;
    readonly taskKind?: LinkTaskKindUseCaseDto;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
}
