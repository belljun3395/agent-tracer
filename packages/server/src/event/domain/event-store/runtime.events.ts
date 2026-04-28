import { defineEventType, optionalArray, optionalNumber, optionalObject, optionalString, requireString } from "./definition/event.definition.js";

export const RUNTIME_EVENT_DEFINITIONS = [
    defineEventType("tool.invoked", (payload) => {
        requireString(payload, "session_id");
        requireString(payload, "tool_name");
        optionalString(payload, "args_hash");
        optionalString(payload, "args_ref");
    }),
    defineEventType("tool.result", (payload) => {
        requireString(payload, "session_id");
        requireString(payload, "tool_name");
        optionalNumber(payload, "duration_ms");
        requireString(payload, "outcome");
        optionalString(payload, "body_ref");
    }),
    defineEventType("prompt.submitted", (payload) => {
        requireString(payload, "session_id");
        optionalString(payload, "prompt_ref");
        optionalString(payload, "event_id_ref");
    }),
    defineEventType("completion.received", (payload) => {
        requireString(payload, "session_id");
        optionalString(payload, "completion_ref");
        optionalString(payload, "event_id_ref");
    }),
    defineEventType("classification.assigned", (payload) => {
        requireString(payload, "event_id_ref");
        optionalString(payload, "lane");
        optionalArray(payload, "tags");
        optionalObject(payload, "matches");
    }),
] as const;

export type RuntimeEventType = (typeof RUNTIME_EVENT_DEFINITIONS)[number]["eventType"];
