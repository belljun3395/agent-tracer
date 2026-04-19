import type { MonitoringTask } from "~domain/index.js";
import type { MonitorPorts } from "~application/ports/index.js";
import type { EndSessionUseCaseIn } from "./end.session.usecase.dto.js";
import {
    requireTask,
    resolveSessionId,
    hasRunningBackgroundDescendants,
    setTaskStatus,
    completeTask,
    completeBgTasks,
} from "../tasks/task.lifecycle.ops.js";
import { shouldAutoCompleteBackground, shouldAutoCompletePrimary, shouldMovePrimaryToWaiting } from "../tasks/services/session.lifecycle.service.js";

export class EndSessionUseCase {
    constructor(private readonly ports: MonitorPorts) {}

    async execute(input: EndSessionUseCaseIn): Promise<{ sessionId: string; task: MonitoringTask }> {
        const task = await requireTask(this.ports, input.taskId);
        const runningCount = await this.ports.sessions.countRunningByTaskId(input.taskId);
        if (!input.sessionId && runningCount > 1) {
            throw new Error(`sessionId is required to end one of multiple running sessions for task: ${input.taskId}`);
        }
        const sessionId = await resolveSessionId(this.ports, input.taskId, input.sessionId);
        if (!sessionId) throw new Error(`No active session for task: ${input.taskId}`);

        const endedAt = new Date().toISOString();
        const sessionBefore = await this.ports.sessions.findById(sessionId);
        await this.ports.sessions.updateStatus(sessionId, "completed", endedAt, input.summary);
        if (sessionBefore) {
            this.ports.notifier.publish({ type: "session.ended", payload: { ...sessionBefore, status: "completed" as const, endedAt } });
        }
        await completeBgTasks(this.ports, input.backgroundCompletions);

        const postRunning = await this.ports.sessions.countRunningByTaskId(task.id);
        const taskKind = task.taskKind ?? "primary";
        const hasRunningBg = taskKind === "primary" ? await hasRunningBackgroundDescendants(this.ports, task.id) : false;
        const meta = input.metadata ? { metadata: input.metadata } : {};

        if (shouldAutoCompleteBackground({ taskKind, runningSessionCount: postRunning }) && task.status === "running") {
            const r = await completeTask(this.ports, { taskId: task.id, sessionId, summary: input.summary ?? "Background session completed", ...meta });
            return { sessionId, task: r.task };
        }
        if (
            shouldAutoCompletePrimary({ taskKind, completeTask: input.completeTask ?? false, runningSessionCount: postRunning, completionReason: input.completionReason, hasRunningBackgroundDescendants: hasRunningBg })
            && (task.status === "running" || task.status === "waiting")
        ) {
            const r = await completeTask(this.ports, { taskId: task.id, sessionId, summary: input.summary ?? "Session ended", ...meta });
            return { sessionId, task: r.task };
        }
        if (
            shouldMovePrimaryToWaiting({ taskKind, completeTask: input.completeTask ?? false, runningSessionCount: postRunning, completionReason: input.completionReason, hasRunningBackgroundDescendants: hasRunningBg })
            && task.status === "running"
        ) {
            const waitingTask = await setTaskStatus(this.ports, task.id, "waiting");
            return { sessionId, task: waitingTask };
        }
        return { sessionId, task: await requireTask(this.ports, task.id) };
    }
}
