import type {
    MONITORING_EVENT_KINDS,
    QUESTION_PHASES,
    EVENT_LANES,
    TODO_STATES,
} from "./event.kind.const.js";

export type TimelineLane = (typeof EVENT_LANES)[number];
export type MonitoringEventKind = (typeof MONITORING_EVENT_KINDS)[number];
export type TodoState = (typeof TODO_STATES)[number];
export type QuestionPhase = (typeof QUESTION_PHASES)[number];
