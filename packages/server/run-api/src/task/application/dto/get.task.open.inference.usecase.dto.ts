import type { OpenInferenceTaskExport } from "@monitor/run-api/task/domain/task.openinference.export.vo.js";

export interface GetTaskOpenInferenceUseCaseIn {
    readonly taskId: string;
}

export interface GetTaskOpenInferenceUseCaseOut {
    readonly openinference: OpenInferenceTaskExport;
}
