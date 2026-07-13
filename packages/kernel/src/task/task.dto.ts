import type { MonitoringTaskKind, TaskOrigin, TaskStatus } from "../ingest/task.const.js";
import type { ResumeTargetDto, SessionDto } from "../session/session.dto.js";

export interface TaskListItemDto {
    readonly id: string;
    readonly userId: string;
    readonly title: string;
    readonly slug: string;
    readonly status: TaskStatus;
    readonly taskKind: MonitoringTaskKind;
    readonly origin: TaskOrigin;
    readonly workspacePath?: string;
    readonly parentTaskId?: string;
    readonly archived: boolean;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastEventAt?: string;
}

export interface TaskPageDto {
    readonly items: readonly TaskListItemDto[];
    readonly nextCursor?: string;
}

export interface TaskDetailDto {
    readonly task: TaskListItemDto;
    readonly sessions: readonly SessionDto[];
    readonly resumeTarget?: ResumeTargetDto;
}
