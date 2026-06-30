import type {
    TaskFinalizeLifecycleInput,
    TaskLifecycleResultSnapshot,
    TaskStartLifecycleInput,
} from "../../../public/task/dto/task.snapshot.dto.js";

export interface ITaskLifecycle {
    startTask(input: TaskStartLifecycleInput): Promise<TaskLifecycleResultSnapshot>;
    finalizeTask(input: TaskFinalizeLifecycleInput): Promise<TaskLifecycleResultSnapshot>;
}
