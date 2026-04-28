import type {
    MonitoringTaskKind,
    TaskCompletionReason,
    TaskStatus,
} from "~task/common/task.status.type.js";

export type RuntimeSessionEndDecision =
    | { readonly action: "complete_task"; readonly summary: "Runtime session ended" | "Background task completed" }
    | { readonly action: "move_task_to_waiting" }
    | { readonly action: "leave_open" };

export interface RuntimeSessionEndProps {
    readonly taskKind: MonitoringTaskKind;
    readonly taskStatus: TaskStatus;
    readonly completeTask: boolean;
    readonly runningSessionCount: number;
    readonly completionReason?: TaskCompletionReason | undefined;
    readonly hasRunningBackgroundDescendants: boolean;
}

/**
 * Domain model for the "runtime session ended" situation.
 *
 * Carries the state needed to decide what should happen to the owning task
 * (complete it, move to waiting, or leave open). The decision is a method
 * on the model — callers don't pull fields out and run their own logic.
 *
 * Distinguished from {@link SessionEntity} (TypeORM-backed, DB-mapped) by
 * being a plain in-memory model. No persistence, no DI, just data + rules.
 */
export class RuntimeSessionEnd {
    readonly taskKind: MonitoringTaskKind;
    readonly taskStatus: TaskStatus;
    readonly completeTask: boolean;
    readonly runningSessionCount: number;
    readonly completionReason: TaskCompletionReason | undefined;
    readonly hasRunningBackgroundDescendants: boolean;

    constructor(props: RuntimeSessionEndProps) {
        this.taskKind = props.taskKind;
        this.taskStatus = props.taskStatus;
        this.completeTask = props.completeTask;
        this.runningSessionCount = props.runningSessionCount;
        this.completionReason = props.completionReason;
        this.hasRunningBackgroundDescendants = props.hasRunningBackgroundDescendants;
    }

    /** Decide what should happen to the task as a result of this session ending. */
    decide(): RuntimeSessionEndDecision {
        if (this.taskStatus !== "running") return { action: "leave_open" };
        if (this.runningSessionCount !== 0) return { action: "leave_open" };

        if (this.taskKind === "background") {
            return { action: "complete_task", summary: "Background task completed" };
        }

        if (this.completeTask && this.canCompletePrimary()) {
            return { action: "complete_task", summary: "Runtime session ended" };
        }

        if (this.shouldMovePrimaryToWaiting()) {
            return { action: "move_task_to_waiting" };
        }

        return { action: "leave_open" };
    }

    private canCompletePrimary(): boolean {
        return !(this.completionReason === "assistant_turn_complete" && this.hasRunningBackgroundDescendants);
    }

    private shouldMovePrimaryToWaiting(): boolean {
        if (this.completionReason === "idle") {
            return !this.completeTask;
        }
        if (this.completionReason === "assistant_turn_complete") {
            return !this.completeTask || this.hasRunningBackgroundDescendants;
        }
        if (this.hasRunningBackgroundDescendants) return false;
        if (this.completeTask) return false;
        return false;
    }
}

/**
 * TaskStatus query helper. Lives here because it's used together with the
 * end-of-session decision flow; promote to a shared task-status helper if
 * more callers appear.
 */
export function isTerminalTaskStatus(status: TaskStatus): boolean {
    return status === "completed" || status === "errored";
}
