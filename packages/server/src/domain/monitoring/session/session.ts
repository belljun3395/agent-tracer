import type { TaskStatus } from "../common/type/task.status.type.js";
import type {
    RuntimeSessionEndDecision,
    RuntimeSessionEndDecisionInput,
} from "./model/session.lifecycle.model.js";

export function decideRuntimeSessionEnd(input: RuntimeSessionEndDecisionInput): RuntimeSessionEndDecision {
    if (input.taskStatus !== "running") return { action: "leave_open" };
    if (input.runningSessionCount !== 0) return { action: "leave_open" };

    if (input.taskKind === "background") {
        return { action: "complete_task", summary: "Background task completed" };
    }

    if (input.completeTask && canCompletePrimary(input)) {
        return { action: "complete_task", summary: "Runtime session ended" };
    }

    if (shouldMovePrimaryToWaiting(input)) {
        return { action: "move_task_to_waiting" };
    }

    return { action: "leave_open" };
}

export function isTerminalTaskStatus(status: TaskStatus): boolean {
    return status === "completed" || status === "errored";
}

function canCompletePrimary(input: RuntimeSessionEndDecisionInput): boolean {
    return !(input.completionReason === "assistant_turn_complete" && input.hasRunningBackgroundDescendants);
}

function shouldMovePrimaryToWaiting(input: RuntimeSessionEndDecisionInput): boolean {
    if (input.completionReason === "idle") {
        return !input.completeTask;
    }
    if (input.completionReason === "assistant_turn_complete") {
        return !input.completeTask || input.hasRunningBackgroundDescendants;
    }
    if (input.hasRunningBackgroundDescendants) return false;
    if (input.completeTask) return false;
    return false;
}
