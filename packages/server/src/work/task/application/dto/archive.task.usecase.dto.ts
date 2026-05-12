export interface ArchiveTaskUseCaseIn {
    readonly taskId: string;
}

export interface ArchiveTaskUseCaseOut {
    readonly status: "archived" | "not_found" | "already_archived";
    readonly archivedIds?: readonly string[];
    readonly archivedAt?: string;
}

export interface UnarchiveTaskUseCaseIn {
    readonly taskId: string;
}

export interface UnarchiveTaskUseCaseOut {
    readonly status: "unarchived" | "not_found" | "not_archived";
    readonly unarchivedIds?: readonly string[];
}
