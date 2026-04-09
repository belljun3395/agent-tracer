import type { ActionName, ToolName } from "./domain/branded.js";
import type { MonitoringEventKind, TimelineLane } from "./domain/types.js";
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
