import type { OpenInferenceTaskExport } from "@monitor/work-api/task/domain/task.openinference.export.model.js";

export interface GetTaskOpenInferenceUseCaseIn {
    readonly taskId: string;
}

export interface GetTaskOpenInferenceUseCaseOut {
    readonly openinference: OpenInferenceTaskExport;
}
