export class TaskNotFoundError extends Error {
    readonly taskId: string;

    constructor(taskId: string) {
        super(`Task not found: ${taskId}`);
        this.name = "TaskNotFoundError";
        this.taskId = taskId;
    }
}
