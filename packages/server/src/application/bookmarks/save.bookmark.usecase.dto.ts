export interface SaveBookmarkUseCaseIn {
    readonly taskId: string;
    readonly eventId?: string;
    readonly title?: string;
    readonly note?: string;
    readonly metadata?: Record<string, unknown>;
}
