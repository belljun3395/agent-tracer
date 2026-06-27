import {
    BadRequestError,
    ConflictError,
    NotFoundError,
} from "@monitor/shared/kernel/domain.error.js";

export class TaskNotFoundError extends NotFoundError {
    readonly taskId: string;

    constructor(taskId: string) {
        super(`Task not found: ${taskId}`);
        this.taskId = taskId;
    }
}

export class TaskAlreadyArchivedError extends ConflictError {
    constructor(public readonly taskId: string) {
        super(`Task is already archived: ${taskId}`);
    }
}

export class TaskNotArchivedError extends BadRequestError {
    constructor(public readonly taskId: string) {
        super(`Task is not archived: ${taskId}`);
    }
}

export class TaskHasNoEventsError extends BadRequestError {
    constructor(public readonly taskId: string) {
        super(`Task has no events yet: ${taskId}`);
    }
}
