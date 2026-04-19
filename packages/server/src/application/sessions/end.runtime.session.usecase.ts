import type { MonitorPorts } from "~application/ports/index.js";
import type { EndRuntimeSessionUseCaseIn } from "./end.runtime.session.usecase.dto.js";
import { endRuntimeSession } from "../tasks/services/runtime.session.service.js";
import { startTask, completeTaskIfIncomplete, completeBgTasks, hasRunningBackgroundDescendants, setTaskStatus } from "../tasks/task.lifecycle.ops.js";

export class EndRuntimeSessionUseCase {
    constructor(private readonly ports: MonitorPorts) {}

    async execute(input: EndRuntimeSessionUseCaseIn): Promise<void> {
        await endRuntimeSession({
            ports: this.ports,
            startTask: (i) => startTask(this.ports, i),
            completeTaskIfIncomplete: (i) => completeTaskIfIncomplete(this.ports, i),
            completeBgTasks: (ids) => completeBgTasks(this.ports, ids),
            hasRunningBackgroundDescendants: (id) => hasRunningBackgroundDescendants(this.ports, id),
            setTaskStatus: (id, status) => setTaskStatus(this.ports, id, status),
        }, input);
    }
}
