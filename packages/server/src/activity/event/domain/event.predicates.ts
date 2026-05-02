import {
    INTERNAL_EVENT_KINDS,
    KIND,
    LANE,
    TASK_LIFECYCLE_EVENT_KINDS,
    TOOL_ACTIVITY_EVENT_KINDS,
} from "~activity/event/domain/common/const/event.kind.const.js";
import type { MonitoringEventKind, TimelineLane } from "~activity/event/domain/common/type/event.kind.type.js";

// --- Lane predicates ---

export function isExplorationLane(lane: TimelineLane): boolean { return lane === LANE.exploration; }
export function isImplementationLane(lane: TimelineLane): boolean { return lane === LANE.implementation; }
export function isPlanningLane(lane: TimelineLane): boolean { return lane === LANE.planning; }
export function isCoordinationLane(lane: TimelineLane): boolean { return lane === LANE.coordination; }
export function isBackgroundLane(lane: TimelineLane): boolean { return lane === LANE.background; }
export function isUserLane(lane: TimelineLane): boolean { return lane === LANE.user; }

// --- Event kind group guards ---

type WithKind = { readonly kind: MonitoringEventKind };

const TOOL_ACTIVITY_SET    = new Set<string>(TOOL_ACTIVITY_EVENT_KINDS);
const TASK_LIFECYCLE_SET    = new Set<string>(TASK_LIFECYCLE_EVENT_KINDS);
const INTERNAL_SET          = new Set<string>(INTERNAL_EVENT_KINDS);

export function isToolActivityEvent(e: WithKind): boolean    { return TOOL_ACTIVITY_SET.has(e.kind); }
export function isTaskLifecycleEvent(e: WithKind): boolean   { return TASK_LIFECYCLE_SET.has(e.kind); }
export function isInternalEvent(e: WithKind): boolean        { return INTERNAL_SET.has(e.kind); }

export function isLlmInteractionEvent(e: WithKind): boolean {
    return e.kind === KIND.assistantResponse || e.kind === KIND.userMessage;
}

// --- Individual kind type guards ---
export function isUserMessageEvent<T extends WithKind>(e: T): e is T & { kind: typeof KIND.userMessage } {
    return e.kind === KIND.userMessage;
}
export function isAgentActivityLoggedEvent<T extends WithKind>(e: T): e is T & { kind: typeof KIND.agentActivityLogged } {
    return e.kind === KIND.agentActivityLogged;
}
