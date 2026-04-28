import type {
    AGENT_ACTIVITY_TYPES,
    EVIDENCE_LEVELS,
    EVENT_RELATION_TYPES,
} from "../const/event.meta.const.js";

export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];
export type EventRelationType = (typeof EVENT_RELATION_TYPES)[number];
export type AgentActivityType = (typeof AGENT_ACTIVITY_TYPES)[number];
