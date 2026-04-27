import { Inject, Injectable } from "@nestjs/common";
import type { ITaskLifecycle } from "~task/public/iservice/task.lifecycle.iservice.js";
import { TASK_LIFECYCLE } from "~task/public/tokens.js";
import type {
    FinalizeTaskAccessInput,
    ITaskLifecycleAccess,
    StartTaskAccessInput,
    TaskLifecycleAccessResult,
} from "../application/outbound/task.lifecycle.access.port.js";

/**
 * Outbound adapter — bridges task module's public ITaskLifecycle to the
 * session-local ITaskLifecycleAccess port. Narrows the result to the fields
 * session actually consumes (just task.id + sessionId).
 */
@Injectable()
export class TaskLifecycleAccessAdapter implements ITaskLifecycleAccess {
    constructor(
        @Inject(TASK_LIFECYCLE) private readonly inner: ITaskLifecycle,
    ) {}

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
