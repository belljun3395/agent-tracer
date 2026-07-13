import type { TaskEntity } from "@monitor/tracer-domain";

export const TIMELINE_TASK_READER = Symbol("TimelineTaskReader");

/** 타임라인 조회가 소유권을 확인할 때 쓰는 태스크 읽기 포트다. */
export interface TimelineTaskReaderPort {
    findById(id: string): Promise<TaskEntity | null>;
}
