import type { TaskEntity, TaskPageFilter } from "@monitor/tracer-domain";

export const TASK_REPOSITORY = Symbol("TaskRepository");

/** 태스크 애그리게이트의 조회와 저장을 제공하는 애플리케이션 포트다. */
export interface TaskRepositoryPort {
    findById(id: string): Promise<TaskEntity | null>;
    findChildren(taskId: string): Promise<TaskEntity[]>;
    findPage(userId: string, filter: TaskPageFilter): Promise<TaskEntity[]>;
    upsert(task: TaskEntity): Promise<void>;
}
