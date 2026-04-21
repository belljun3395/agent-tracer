import { defineEventType, optionalString, requireString } from "./event.type.js";

export const SESSION_EVENT_DEFINITIONS = [
    defineEventType("session.started", (payload) => {
        requireString(payload, "task_id");
        requireString(payload, "session_id");
        optionalString(payload, "runtime_source");
        optionalString(payload, "runtime_session_id");
    }),
    defineEventType("session.ended", (payload) => {
        requireString(payload, "session_id");
        requireString(payload, "outcome");
        optionalString(payload, "summary");
    }),
    defineEventType("session.bound", (payload) => {
        requireString(payload, "session_id");
        requireString(payload, "runtime_source");
        requireString(payload, "runtime_session_id");
    }),
] as const;

export type SessionEventType = (typeof SESSION_EVENT_DEFINITIONS)[number]["eventType"];
