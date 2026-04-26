export interface SaveBookmarkUseCaseIn {
    readonly taskId: string;
    readonly eventId?: string;
    readonly title?: string;
    readonly note?: string;
    readonly metadata?: Record<string, unknown>;
}

export interface SavedBookmarkUseCaseDto {
    readonly id: string;
    readonly kind: "task" | "event";
    readonly taskId: string;
    readonly eventId?: string;
    readonly title: string;
    readonly note?: string;
    readonly metadata: Record<string, unknown>;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly taskTitle?: string;
    readonly eventTitle?: string;
}

export interface SaveBookmarkUseCaseOut {
    readonly bookmark: SavedBookmarkUseCaseDto;
}
