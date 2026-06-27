import type { TaskStatus } from "@monitor/shared/task/task.status.const.js";

/**
 * Whether a logged event's declared task-status effect should be applied.
 * Owned by work (task) — moved here from the event module when timeline became
 * a leaf: deciding what a recorded event does to a task is a task concern.
 */
export function shouldApplyLoggedEventTaskStatusEffect(input: {
    readonly currentStatus: TaskStatus;
    readonly desiredStatus: TaskStatus;
}): boolean {
    return input.desiredStatus !== input.currentStatus &&
        input.currentStatus !== "completed";
}
