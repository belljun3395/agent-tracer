import type { TaskEntity } from "@monitor/tracer-domain";

export const RULE_TASK_READER = Symbol("RuleTaskReader");

/** 규칙 조회가 태스크 소유권을 확인하는 조회 포트다. */
export interface TaskReaderPort {
    findById(id: string): Promise<TaskEntity | null>;
}
