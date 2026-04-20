import type { IRuntimeBindingRepository } from "../ports/repository/runtime.binding.repository.js";
import type { ISessionRepository } from "../ports/repository/session.repository.js";
import type { ResolveRuntimeBindingUseCaseIn, ResolveRuntimeBindingUseCaseOut } from "./resolve.runtime.binding.usecase.dto.js";

export class ResolveRuntimeBindingUseCase {
    constructor(
        private readonly runtimeBindings: IRuntimeBindingRepository,
        private readonly sessions: ISessionRepository,
    ) {}

    async execute(input: ResolveRuntimeBindingUseCaseIn): Promise<ResolveRuntimeBindingUseCaseOut | null> {
        const { runtimeSource, runtimeSessionId } = input;

        const binding = await this.runtimeBindings.find(runtimeSource, runtimeSessionId);
        if (binding) {
            return { taskId: String(binding.taskId), sessionId: String(binding.monitorSessionId) };
        }

        // Fall back: resolve taskId from the binding row (which survives clearSession), then find
        // the most recently started session for that task.
        const taskId = await this.runtimeBindings.findTaskId(runtimeSource, runtimeSessionId);
        if (!taskId) return null;

        const allSessions = await this.sessions.findByTaskId(taskId);
        const latest = [...allSessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
        if (!latest) return null;

        return { taskId: String(taskId), sessionId: String(latest.id) };
    }
}
