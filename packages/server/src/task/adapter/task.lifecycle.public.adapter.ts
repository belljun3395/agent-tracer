import { Injectable } from "@nestjs/common";
import { TaskLifecycleService } from "../service/task.lifecycle.service.js";
import type { ITaskLifecycle } from "../public/iservice/task.lifecycle.iservice.js";
import type {
    TaskFinalizeLifecycleInput,
    TaskLifecycleResultSnapshot,
    TaskStartLifecycleInput,
} from "../public/dto/task.snapshot.dto.js";

/**
 * Public adapter — implements ITaskLifecycle by delegating to internal service.
 */
@Injectable()
export class TaskLifecyclePublicAdapter implements ITaskLifecycle {
    constructor(private readonly inner: TaskLifecycleService) {}

    async startTask(input: TaskStartLifecycleInput): Promise<TaskLifecycleResultSnapshot> {
        const result = await this.inner.startTask(input);
        return result as unknown as TaskLifecycleResultSnapshot;
    }

    async finalizeTask(input: TaskFinalizeLifecycleInput): Promise<TaskLifecycleResultSnapshot> {
        const result = await this.inner.finalizeTask(input);
        return result as unknown as TaskLifecycleResultSnapshot;
    }
}
