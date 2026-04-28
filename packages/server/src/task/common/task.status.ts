import type { TaskStatus } from "~task/common/task.status.type.js";

/** Statuses considered "finished" — task is done and won't progress further. */
export const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = ["completed", "errored"] as const;
