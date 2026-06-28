import type {
    TaskSummary,
    TaskSummaryToolCount,
    TaskSummaryFile,
    TaskSummaryCommand,
} from "../../public/types/task.summary.js";

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
