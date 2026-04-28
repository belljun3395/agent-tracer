import { KIND } from "~event/domain/common/const/event.kind.const.js";
import { readString } from "./event.metadata.js";
import type { MonitoringPhaseBucket } from "./model/event.phase.model.js";
import type { TimelineEvent } from "./model/timeline.event.model.js";

export function phaseForEvent(event: TimelineEvent): MonitoringPhaseBucket {
    switch (event.kind) {
        case KIND.userMessage:
            return "waiting";
        case KIND.questionLogged: {
            const phase = readString(event.metadata, "questionPhase");
            return phase === "concluded" ? "planning" : "waiting";
        }
        case KIND.todoLogged:
        case KIND.thoughtLogged:
        case KIND.planLogged:
        case KIND.contextSaved:
        case KIND.taskStart:
            return "planning";
        case KIND.fileChanged:
            return "exploration";
        case KIND.agentActivityLogged:
            return "coordination";
        case KIND.verificationLogged:
        case KIND.ruleLogged:
            return "verification";
        case KIND.actionLogged:
        case KIND.terminalCommand:
        case KIND.toolUsed:
            return phaseFromLane(event.lane);
        case KIND.taskComplete:
        case KIND.taskError:
            return "verification";
        default:
            return phaseFromLane(event.lane);
    }
}

function phaseFromLane(lane: TimelineEvent["lane"]): MonitoringPhaseBucket {
    switch (lane) {
        case "planning":       return "planning";
        case "exploration":    return "exploration";
        case "implementation": return "implementation";
        case "coordination":   return "coordination";
        case "background":     return "coordination";
        case "user":
        case "questions":
        case "todos":
        case "telemetry":
        case "rule":           return "waiting";
    }
}
