import { defineEventType, optionalObject, optionalString, requireString } from "./event.type.js";

export const SYSTEM_EVENT_DEFINITIONS = [
    defineEventType("rule.registered", (payload) => {
        requireString(payload, "rule_id");
        requireString(payload, "name");
        requireString(payload, "scope");
        requireString(payload, "source");
        requireString(payload, "severity");
        optionalString(payload, "task_id");
    }),
    defineEventType("rule.updated", (payload) => {
        requireString(payload, "rule_id");
        optionalObject(payload, "patch");
    }),
    defineEventType("rule_command.matched", (payload) => {
        requireString(payload, "rule_id");
        requireString(payload, "event_id_ref");
    }),
] as const;

export type SystemEventType = (typeof SYSTEM_EVENT_DEFINITIONS)[number]["eventType"];
