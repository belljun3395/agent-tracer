/**
 * Public event predicates — pure helpers safe to expose for cross-module
 * consumers (task display titles, openinference export, turn segmentation,
 * verification matching).
 */
export {
    isTimelineLane,
    isTodoState,
} from "~event/domain/common/event.kind.js";

export {
    isExplorationLane,
    isImplementationLane,
    isPlanningLane,
    isCoordinationLane,
    isBackgroundLane,
    isUserLane,
    isToolActivityEvent,
    isTaskLifecycleEvent,
    isInternalEvent,
    isLlmInteractionEvent,
    isRuleOrVerificationEvent,
    isUserMessageEvent,
    isAssistantResponseEvent,
    isAgentActivityLoggedEvent,
    isFileChangedEvent,
} from "~event/domain/event.predicates.js";
