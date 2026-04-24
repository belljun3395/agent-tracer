export class TaskNotFoundError extends Error {
    readonly taskId: string;

    constructor(taskId: string) {
        super(`Task not found: ${taskId}`);
        this.name = "TaskNotFoundError";
        this.taskId = taskId;
    }
}

export class TurnPartitionVersionMismatchError extends Error {
    readonly expected: number;
    readonly actual: number;

    constructor(expected: number, actual: number) {
        super(`Turn partition version mismatch: expected ${expected}, found ${actual}`);
        this.name = "TurnPartitionVersionMismatchError";
        this.expected = expected;
        this.actual = actual;
    }
}
