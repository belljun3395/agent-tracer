import type {
    INGEST_EVENT_KINDS,
    MONITORING_EVENT_KINDS,
    EVENT_LANES,
    TODO_STATES,
} from "../const/event.kind.const.js";

export type TimelineLane = (typeof EVENT_LANES)[number];
export type IngestEventKind = (typeof INGEST_EVENT_KINDS)[number];
export type MonitoringEventKind = (typeof MONITORING_EVENT_KINDS)[number];
export type TodoState = (typeof TODO_STATES)[number];
