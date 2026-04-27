import { Injectable } from "@nestjs/common";
import { TaskLifecycleService } from "~application/tasks/services/task.lifecycle.service.js";
import type {
    FinalizeTaskAccessInput,
    ITaskLifecycleAccess,
    StartTaskAccessInput,
    TaskLifecycleAccessResult,
} from "../application/outbound/task.lifecycle.access.port.js";

/**
 * Outbound adapter — bridges TaskLifecycleService (tasks module) to the
 * session-local ITaskLifecycleAccess port. The result is narrowed so callers
 * only see the fields session actually consumes.
 */
@Injectable()
export class TaskLifecycleAccessAdapter implements ITaskLifecycleAccess {
    constructor(private readonly inner: TaskLifecycleService) {}

    async startTask(input: StartTaskAccessInput): Promise<TaskLifecycleAccessResult> {
        const result = await this.inner.startTask(input);
        return {
            task: { id: result.task.id },
            ...(result.sessionId !== undefined ? { sessionId: result.sessionId } : {}),
        };
    }

    async finalizeTask(input: FinalizeTaskAccessInput): Promise<TaskLifecycleAccessResult> {
        const result = await this.inner.finalizeTask(input);
        return {
            task: { id: result.task.id },
            ...(result.sessionId !== undefined ? { sessionId: result.sessionId } : {}),
        };
    }
}
