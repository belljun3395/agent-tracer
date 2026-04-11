import { TaskSlug, WorkspacePath } from "./ids.js";
import type { MonitoringEventKind, MonitoringTaskInput, TimelineLane } from "./types.js";
/**
 * Normalizes arbitrary workspace path input into the branded workspace path type.
 */
export declare function normalizeWorkspacePath(path: string): WorkspacePath;
/**
 * Derives the stable task slug used for storage and lookup from task input.
 */
export declare function createTaskSlug(input: MonitoringTaskInput): TaskSlug;
/**
 * Supplies the default lane for an event kind when no stronger signal exists.
 */
export declare function defaultLaneForEventKind(kind: MonitoringEventKind): TimelineLane;
/**
 * Coerces lane aliases and legacy labels into the canonical timeline lane set.
 */
export declare function normalizeLane(raw: string): TimelineLane;
//# sourceMappingURL=utils.d.ts.map