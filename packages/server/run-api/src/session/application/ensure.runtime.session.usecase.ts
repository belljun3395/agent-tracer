import { Inject, Injectable } from "@nestjs/common";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { MONITORING_TASK_KIND, RUNNING_TASK_STATUS } from "@monitor/run-api/task/common/task.status.const.js";
import { isTaskRunning } from "@monitor/run-api/task/domain/task.predicates.policy.js";
import { isRunningSession } from "../domain/session.predicates.policy.js";
import { Transactional } from "typeorm-transactional";
import { normalizeWorkspacePath } from "@monitor/run-api/task/public/helpers.js";
import { SessionLifecycleService } from "../service/session.lifecycle.service.js";
import { RuntimeBindingService } from "../service/runtime.binding.service.js";
import {
    CLOCK_PORT,
    ID_GENERATOR_PORT,
    NOTIFICATION_PUBLISHER_PORT,
    TASK_LIFECYCLE_ACCESS_PORT,
} from "./outbound/tokens.js";
import { TASK_ACCESS } from "@monitor/run-api/task/public/tokens.js";
import type { IClock } from "./outbound/clock.port.js";
import type { IIdGenerator } from "./outbound/id.generator.port.js";
import type { ISessionNotificationPublisher } from "./outbound/notification.publisher.port.js";
import type { ITaskAccess } from "@monitor/run-api/task/public/iservice/task.access.iservice.js";
import type { ITaskLifecycleAccess } from "./outbound/task.lifecycle.access.port.js";
import type {
    EnsureRuntimeSessionIn,
    EnsureRuntimeSessionOut,
} from "./dto/ensure.runtime.session.dto.js";

@Injectable()
export class EnsureRuntimeSessionUseCase {
    constructor(
        private readonly sessions: SessionLifecycleService,
        private readonly runtimeBindings: RuntimeBindingService,
        @Inject(TASK_ACCESS) private readonly tasks: ITaskAccess,
        @Inject(TASK_LIFECYCLE_ACCESS_PORT) private readonly taskLifecycle: ITaskLifecycleAccess,
        @Inject(NOTIFICATION_PUBLISHER_PORT) private readonly notifier: ISessionNotificationPublisher,
        @Inject(CLOCK_PORT) private readonly clock: IClock,
        @Inject(ID_GENERATOR_PORT) private readonly idGen: IIdGenerator,
    ) {}

    @Transactional()
    async execute(input: EnsureRuntimeSessionIn): Promise<EnsureRuntimeSessionOut> {
        const workspacePath = input.workspacePath
            ? normalizeWorkspacePath(input.workspacePath)
            : undefined;

        // 이미 실행 중인 바인딩은 새 세션을 만들지 않고 기존 monitor 세션으로 고정한다.
        const binding = await this.runtimeBindings.findActive(input.runtimeSource, input.runtimeSessionId);
        if (binding) {
            const session = await this.sessions.findById(binding.monitorSessionId);
            if (!session || !isRunningSession(session)) {
                await this.runtimeBindings.clearSession(input.runtimeSource, input.runtimeSessionId);
            } else {
                return {
                    taskId: binding.taskId,
                    sessionId: binding.monitorSessionId,
                    taskCreated: false,
                    sessionCreated: false,
                };
            }
        }

        const existingTaskId = await this.runtimeBindings.findTaskId(input.runtimeSource, input.runtimeSessionId);
        if (existingTaskId) {
            const task = await this.tasks.findById(existingTaskId);

            // 읽기 전용 재연결은 태스크를 running으로 되돌리지 않고 마지막 세션을 반환한다.
            if (input.resume === false) {
                const sessions = await this.sessions.findByTaskId(existingTaskId);
                const latest = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
                if (latest) {
                    return {
                        taskId: existingTaskId,
                        sessionId: latest.id,
                        taskCreated: false,
                        sessionCreated: false,
                    };
                }
            }

            // 재개는 기존 태스크 관계를 유지하고 새 monitor 세션만 붙인다.
            const sessionId = this.idGen.newUuid();
            const startedAt = this.clock.nowIso();
            if (task && (!isTaskRunning(task) || task.runtimeSource !== input.runtimeSource)) {
                const resumedTask = await this.tasks.upsert({
                    ...task,
                    taskKind: task.taskKind ?? MONITORING_TASK_KIND.primary,
                    status: RUNNING_TASK_STATUS,
                    updatedAt: startedAt,
                    lastSessionStartedAt: startedAt,
                    runtimeSource: input.runtimeSource,
                });
                this.notifier.publish({ type: NOTIFICATION_TYPE.taskUpdated, payload: resumedTask });
            }

            const session = await this.sessions.create({
                id: sessionId,
                taskId: existingTaskId,
                status: "running",
                startedAt,
            });
            this.notifier.publish({ type: NOTIFICATION_TYPE.sessionStarted, payload: session });
            await this.runtimeBindings.upsert({
                runtimeSource: input.runtimeSource,
                runtimeSessionId: input.runtimeSessionId,
                taskId: existingTaskId,
                monitorSessionId: sessionId,
            });
            return {
                taskId: existingTaskId,
                sessionId,
                taskCreated: false,
                sessionCreated: true,
            };
        }

        // 처음 본 런타임 세션은 태스크와 monitor 세션을 함께 생성한다.
        const result = await this.taskLifecycle.startTask({
            ...(input.taskId ? { taskId: input.taskId } : {}),
            title: input.title,
            ...(workspacePath ? { workspacePath } : {}),
            runtimeSource: input.runtimeSource,
            ...(input.parentTaskId
                ? { taskKind: MONITORING_TASK_KIND.background, parentTaskId: input.parentTaskId }
                : {}),
            ...(input.parentSessionId ? { parentSessionId: input.parentSessionId } : {}),
            ...(input.origin ? { origin: input.origin } : {}),
        });
        const taskId = result.task.id;
        const sessionId = result.sessionId!;
        await this.runtimeBindings.upsert({
            runtimeSource: input.runtimeSource,
            runtimeSessionId: input.runtimeSessionId,
            taskId,
            monitorSessionId: sessionId,
        });
        return { taskId, sessionId, taskCreated: true, sessionCreated: true };
    }
}
