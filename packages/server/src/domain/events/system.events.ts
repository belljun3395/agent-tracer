import { defineEventType, optionalString, requireString } from "./definition/event.definition.js";

export const SYSTEM_EVENT_DEFINITIONS = [
    defineEventType("rule_command.registered", (payload) => {
        requireString(payload, "rule_id");
        requireString(payload, "pattern");
        requireString(payload, "label");
        optionalString(payload, "task_id");
    }),
    defineEventType("rule_command.matched", (payload) => {
        requireString(payload, "rule_id");
        requireString(payload, "event_id_ref");
    }),
] as const;

export type SystemEventType = (typeof SYSTEM_EVENT_DEFINITIONS)[number]["eventType"];
