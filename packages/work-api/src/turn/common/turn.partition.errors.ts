import { ConflictError, NotFoundError } from "@monitor/shared/kernel/domain.error.js";

export class TaskNotFoundError extends NotFoundError {
    readonly taskId: string;

    constructor(taskId: string) {
        super(`Task not found: ${taskId}`);
        this.taskId = taskId;
    }
}

export class TurnPartitionVersionMismatchError extends ConflictError {
    readonly expected: number;
    readonly actual: number;

    constructor(expected: number, actual: number) {
        super(
            `Turn partition version mismatch: expected ${expected}, found ${actual}`,
            { expected, actual },
        );
        this.expected = expected;
        this.actual = actual;
    }
}
