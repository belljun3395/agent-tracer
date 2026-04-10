import type { ActionName, MonitoringEventKind, TimelineLane, ToolName } from "../domain.js";
export interface ClassifyEventInput {
    readonly kind: MonitoringEventKind;
    readonly title?: string;
    readonly body?: string;
    readonly command?: string;
    readonly toolName?: ToolName;
    readonly actionName?: ActionName;
    readonly filePaths?: readonly string[];
    readonly lane?: TimelineLane;
}
