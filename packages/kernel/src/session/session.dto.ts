export interface SessionDto {
    readonly id: string;
    readonly taskId: string;
    readonly runtimeSource: string;
    readonly runtimeSessionId: string;
    readonly status: string;
    readonly summary: string | null;
    readonly startedAt: string;
    readonly endedAt: string | null;
}

export interface ResumeTargetDto {
    readonly taskId: string;
    readonly runtimeSource: string;
    readonly runtimeSessionId: string;
    readonly workspacePath?: string;
}
