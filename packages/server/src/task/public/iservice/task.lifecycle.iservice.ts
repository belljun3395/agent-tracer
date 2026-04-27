import type {
    TaskFinalizeLifecycleInput,
    TaskLifecycleResultSnapshot,
    TaskStartLifecycleInput,
} from "../dto/task.snapshot.dto.js";

/**
 * Public iservice — exposes task lifecycle operations to other modules.
 * Consumed by session module for runtime session orchestration.
 */
export interface ITaskLifecycle {
    startTask(input: TaskStartLifecycleInput): Promise<TaskLifecycleResultSnapshot>;
    finalizeTask(input: TaskFinalizeLifecycleInput): Promise<TaskLifecycleResultSnapshot>;
}
