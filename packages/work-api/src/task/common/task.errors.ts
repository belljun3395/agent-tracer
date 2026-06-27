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

/** 이미 보관된 태스크를 다시 보관하려 할 때(409). */
export class TaskAlreadyArchivedError extends ConflictError {
    constructor(public readonly taskId: string) {
        super(`Task is already archived: ${taskId}`);
    }
}

/** 보관되지 않은 태스크를 해제하려 할 때(400). */
export class TaskNotArchivedError extends BadRequestError {
    constructor(public readonly taskId: string) {
        super(`Task is not archived: ${taskId}`);
    }
}

/** 요약/제안할 이벤트가 아직 없는 태스크(400). */
export class TaskHasNoEventsError extends BadRequestError {
    constructor(public readonly taskId: string) {
        super(`Task has no events yet: ${taskId}`);
    }
}
