import type { MonitorPorts } from "~application/ports/index.js";
import type { EnsureRuntimeSessionUseCaseIn, EnsureRuntimeSessionUseCaseOut } from "./ensure.runtime.session.usecase.dto.js";
import { ensureRuntimeSession } from "../tasks/services/runtime.session.service.js";
import { startTask, completeTaskIfIncomplete, completeBgTasks, hasRunningBackgroundDescendants, setTaskStatus } from "../tasks/task.lifecycle.ops.js";

export class EnsureRuntimeSessionUseCase {
    constructor(private readonly ports: MonitorPorts) {}

    async execute(input: EnsureRuntimeSessionUseCaseIn): Promise<EnsureRuntimeSessionUseCaseOut> {
        return ensureRuntimeSession({
            ports: this.ports,
            startTask: (i) => startTask(this.ports, i),
            completeTaskIfIncomplete: (i) => completeTaskIfIncomplete(this.ports, i),
            completeBgTasks: (ids) => completeBgTasks(this.ports, ids),
            hasRunningBackgroundDescendants: (id) => hasRunningBackgroundDescendants(this.ports, id),
            setTaskStatus: (id, status) => setTaskStatus(this.ports, id, status),
        }, input);
    }
}
