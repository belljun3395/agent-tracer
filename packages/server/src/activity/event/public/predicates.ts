/**
 * Public event predicates — pure helpers safe to expose for cross-module
 * consumers (task display titles, openinference export, turn segmentation,
 * verification matching).
 */
;

export {
    isExplorationLane,
    isImplementationLane,
    isPlanningLane,
    
    
    isUserLane,
    isToolActivityEvent,
    isTaskLifecycleEvent,
    isInternalEvent,
    isLlmInteractionEvent,
    
    isUserMessageEvent,
    
    isAgentActivityLoggedEvent,
    
} from "~activity/event/domain/event.predicates.js";
