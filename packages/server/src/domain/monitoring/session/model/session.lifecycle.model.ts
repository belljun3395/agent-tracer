import type {
    MonitoringTaskKind,
    TaskCompletionReason,
    TaskStatus,
} from "~domain/monitoring/common/type/task.status.type.js";

export interface RuntimeSessionEndDecisionInput {
    readonly taskKind: MonitoringTaskKind;
    readonly taskStatus: TaskStatus;
    readonly completeTask: boolean;
    readonly runningSessionCount: number;
    readonly completionReason?: TaskCompletionReason | undefined;
    readonly hasRunningBackgroundDescendants: boolean;
}

export type RuntimeSessionEndDecision =
    | { readonly action: "complete_task"; readonly summary: "Runtime session ended" | "Background task completed" }
    | { readonly action: "move_task_to_waiting" }
    | { readonly action: "leave_open" };
