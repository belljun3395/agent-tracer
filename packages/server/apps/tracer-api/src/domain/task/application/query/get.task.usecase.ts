import { Inject, Injectable } from "@nestjs/common";
import { TaskView, type TaskListItemDto } from "@monitor/tracer-domain";
import type { ResumeTargetDto, SessionDto, TaskDetailDto } from "@monitor/kernel";
import { SESSION_READER, type SessionReaderPort } from "~tracer-api/domain/task/port/session.reader.port.js";
import { TASK_REPOSITORY, type TaskRepositoryPort } from "~tracer-api/domain/task/port/task.repository.port.js";
import {
    TASK_USER_STATE_REPOSITORY,
    type TaskUserStateRepositoryPort,
} from "~tracer-api/domain/task/port/task.user.state.repository.port.js";

export type { SessionDto };

export interface TaskDetail extends TaskDetailDto {
    readonly task: TaskListItemDto;
    readonly sessions: readonly SessionDto[];
}

@Injectable()
export class GetTaskUseCase {
    constructor(
        @Inject(TASK_REPOSITORY) private readonly tasks: TaskRepositoryPort,
        @Inject(TASK_USER_STATE_REPOSITORY) private readonly states: TaskUserStateRepositoryPort,
        @Inject(SESSION_READER) private readonly sessions: SessionReaderPort,
    ) {}

    async execute(userId: string, taskId: string): Promise<TaskDetail | null> {
        const task = await this.tasks.findById(taskId);
        // 남의 작업은 존재 여부도 드러내지 않는다.
        if (task === null || !task.isOwnedBy(userId)) return null;
        const [state, sessions] = await Promise.all([
            this.states.findById(taskId),
            this.sessions.findByTask(taskId),
        ]);
        const taskDto = new TaskView(task, state).toListItem();
        const sessionDtos = sessions.map(toSessionDto);
        const resumeTarget = selectResumeTarget(taskDto, sessionDtos);
        return {
            task: taskDto,
            sessions: sessionDtos,
            ...(resumeTarget ? { resumeTarget } : {}),
        };
    }
}

function selectResumeTarget(
    task: TaskListItemDto,
    sessions: readonly SessionDto[],
): ResumeTargetDto | undefined {
    const session = sessions.find((item) => item.runtimeSessionId.trim().length > 0);
    if (session === undefined) return undefined;
    return {
        taskId: task.id,
        runtimeSource: session.runtimeSource,
        runtimeSessionId: session.runtimeSessionId,
        ...(task.workspacePath !== undefined ? { workspacePath: task.workspacePath } : {}),
    };
}

function toSessionDto(session: {
    id: string;
    taskId: string;
    runtimeSource: string;
    runtimeSessionId: string;
    status: string;
    summary: string | null;
    startedAt: Date;
    endedAt: Date | null;
}): SessionDto {
    return {
        id: session.id,
        taskId: session.taskId,
        runtimeSource: session.runtimeSource,
        runtimeSessionId: session.runtimeSessionId,
        status: session.status,
        summary: session.summary,
        startedAt: session.startedAt.toISOString(),
        endedAt: session.endedAt !== null ? session.endedAt.toISOString() : null,
    };
}
