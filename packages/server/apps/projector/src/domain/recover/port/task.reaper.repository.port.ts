import type { TaskEntity } from "@monitor/tracer-domain";

/** 고착 자식 작업 회수가 사용하는 태스크 저장소 포트다. */
export interface TaskReaperTaskRepository {
    findReapableChildren(before: Date, limit: number): Promise<TaskEntity[]>;
    upsert(task: TaskEntity): Promise<void>;
}

/** 회수 트랜잭션 안에서 태스크 회수가 사용하는 저장소 경계다. */
export interface TaskReaperRepositories {
    readonly tasks: TaskReaperTaskRepository;
}
