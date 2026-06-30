import type { OpenInferenceTaskExport } from "@monitor/run-api/application/task/task.openinference.export.js";

export interface GetTaskOpenInferenceUseCaseIn {
    readonly taskId: string;
}

export interface GetTaskOpenInferenceUseCaseOut {
    readonly openinference: OpenInferenceTaskExport;
}
