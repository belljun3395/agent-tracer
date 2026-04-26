export class BookmarkTaskNotFoundError extends Error {
    constructor(readonly taskId: string) {
        super(`Task not found: ${taskId}`);
        this.name = "BookmarkTaskNotFoundError";
    }
}

export class BookmarkEventNotFoundError extends Error {
    constructor(readonly eventId: string) {
        super(`Event not found: ${eventId}`);
        this.name = "BookmarkEventNotFoundError";
    }
}

export class BookmarkEventTaskMismatchError extends Error {
    constructor(readonly eventId: string, readonly taskId: string) {
        super(`Event ${eventId} does not belong to task ${taskId}`);
        this.name = "BookmarkEventTaskMismatchError";
    }
}
