export interface ArchiveTaskUseCaseIn {
    readonly taskId: string;
}

export interface ArchiveTaskUseCaseOut {
    readonly archivedIds: readonly string[];
    readonly archivedAt: string;
}

export interface UnarchiveTaskUseCaseIn {
    readonly taskId: string;
}

export interface UnarchiveTaskUseCaseOut {
    readonly unarchivedIds: readonly string[];
}
