import type { TaskTagEntity } from "@monitor/tracer-domain";

export const TASK_TAG_REPOSITORY = Symbol("TaskTagRepository");

/** 태스크·태그 부착 관계의 조회와 갱신을 제공하는 애플리케이션 포트다. */
export interface TaskTagRepositoryPort {
    findByTask(userId: string, taskId: string): Promise<TaskTagEntity[]>;
    findByTag(userId: string, tagId: string): Promise<TaskTagEntity[]>;
    findByTasks(userId: string, taskIds: readonly string[]): Promise<TaskTagEntity[]>;
    countByTag(userId: string): Promise<Record<string, number>>;
    insertMany(rows: readonly TaskTagEntity[]): Promise<void>;
    deleteByTaskAndTags(userId: string, taskId: string, tagIds: readonly string[]): Promise<void>;
    deleteByTag(userId: string, tagId: string): Promise<void>;
}
