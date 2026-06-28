import type {
    TaskSummary,
    TaskSummaryToolCount,
    TaskSummaryFile,
    TaskSummaryCommand,
} from "../../public/types/task.summary.js";

// 발행 타입(public/types/task.summary)을 단일 원천으로 쓰고, 내부 참조용 별칭만 둔다.
export type TaskSummaryUseCaseDto = TaskSummary;
export type TaskSummaryToolCountDto = TaskSummaryToolCount;
export type TaskSummaryFileDto = TaskSummaryFile;
export type TaskSummaryCommandDto = TaskSummaryCommand;

export interface GetTaskSummaryUseCaseIn {
    readonly taskId: string;
}

export interface GetTaskSummaryUseCaseOut {
    readonly summary: TaskSummaryUseCaseDto | null;
}
