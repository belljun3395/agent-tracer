import type { MonitoringEventKind, TimelineLane } from "./domain/types.js";

export interface ClassifyEventInput {
  readonly kind: MonitoringEventKind;
  readonly title?: string;
  readonly body?: string;
  readonly command?: string;
  readonly toolName?: string;
  readonly actionName?: string;
  readonly filePaths?: readonly string[];
  readonly lane?: TimelineLane;
}
