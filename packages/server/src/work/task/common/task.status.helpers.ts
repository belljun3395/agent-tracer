import { TASK_STATUSES } from "./task.status.const.js";
import type { TaskStatus } from "./task.status.type.js";

const TASK_STATUS_SET = new Set<string>(TASK_STATUSES);

export interface TaskStatusTally {
    readonly totalTasks: number;
    readonly runningTasks: number;
    readonly waitingTasks: number;
    readonly completedTasks: number;
    readonly erroredTasks: number;
}

function isTaskStatus(value: string | undefined): value is TaskStatus {
    return value !== undefined && TASK_STATUS_SET.has(value);
}

export function tallyTaskStatuses(
    statuses: ReadonlyArray<string | null | undefined>,
): TaskStatusTally {
    let totalTasks = 0;
    let runningTasks = 0;
    let waitingTasks = 0;
    let completedTasks = 0;
    let erroredTasks = 0;
    for (const status of statuses) {
        if (!isTaskStatus(status ?? undefined)) continue;
        totalTasks += 1;
        switch (status) {
            case "running":
                runningTasks += 1;
                break;
            case "waiting":
                waitingTasks += 1;
                break;
            case "completed":
                completedTasks += 1;
                break;
            case "errored":
                erroredTasks += 1;
                break;
        }
    }
    return {
        totalTasks,
        runningTasks,
        waitingTasks,
        completedTasks,
        erroredTasks,
    };
}
