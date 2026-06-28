import type {
    MonitoringTaskKind,
    TaskCompletionReason,
    TaskStatus,
} from "@monitor/shared/task/task.status.const.js";

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

    // 마지막 실행 세션이 끝났을 때 태스크를 완료, 대기, 유지 중 하나로 수렴시킨다.
    decide(): RuntimeSessionEndDecision {
        if (this.taskStatus !== "running") return { action: "leave_open" };
        if (this.runningSessionCount !== 0) return { action: "leave_open" };

        if (this.taskKind === "background") {
            return { action: "complete_task", summary: "Background task completed" };
        }

        if (this.isSessionTerminatingReason()) {
            return { action: "complete_task", summary: "Runtime session ended" };
        }

        if (this.completeTask && this.canCompletePrimary()) {
            return { action: "complete_task", summary: "Runtime session ended" };
        }

        if (this.shouldMovePrimaryToWaiting()) {
            return { action: "move_task_to_waiting" };
        }

        return { action: "leave_open" };
    }

    private isSessionTerminatingReason(): boolean {
        return this.completionReason === "explicit_exit"
            || this.completionReason === "runtime_terminated";
    }

    private canCompletePrimary(): boolean {
        // background가 남아 있으면 assistant turn 종료만으로 primary를 완료하지 않는다.
        return !(this.completionReason === "assistant_turn_complete" && this.hasRunningBackgroundDescendants);
    }

    private shouldMovePrimaryToWaiting(): boolean {
        if (this.completionReason === "idle") {
            return !this.completeTask;
        }
        if (this.completionReason === "assistant_turn_complete") {
            return !this.completeTask || this.hasRunningBackgroundDescendants;
        }
        return false;
    }
}

export function isTerminalTaskStatus(status: TaskStatus): boolean {
    return status === "completed" || status === "errored";
}
