export class TaskNotFoundError extends Error {
    readonly taskId: string;

    constructor(taskId: string) {
        super(`Task not found: ${taskId}`);
        this.name = "TaskNotFoundError";
        this.taskId = taskId;
    }
}

/** 이미 보관된 태스크를 다시 보관하려 할 때(409). */
export class TaskAlreadyArchivedError extends Error {
    constructor(public readonly taskId: string) {
        super(`Task is already archived: ${taskId}`);
        this.name = "TaskAlreadyArchivedError";
    }
}

/** 보관되지 않은 태스크를 해제하려 할 때(400). */
export class TaskNotArchivedError extends Error {
    constructor(public readonly taskId: string) {
        super(`Task is not archived: ${taskId}`);
        this.name = "TaskNotArchivedError";
    }
}

/** 요약/제안할 이벤트가 아직 없는 태스크(400). */
export class TaskHasNoEventsError extends Error {
    constructor(public readonly taskId: string) {
        super(`Task has no events yet: ${taskId}`);
        this.name = "TaskHasNoEventsError";
    }
}
