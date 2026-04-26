import { defineEventType, optionalArray, requireNumber, requireString } from "./definition/event.definition.js";

export const CURATION_EVENT_DEFINITIONS = [
    defineEventType("turn.partition_updated", (payload) => {
        requireString(payload, "task_id");
        requireNumber(payload, "version");
        optionalArray(payload, "groups");
    }),
    defineEventType("turn.partition_reset", (payload) => {
        requireString(payload, "task_id");
    }),
] as const;

export type CurationEventType = (typeof CURATION_EVENT_DEFINITIONS)[number]["eventType"];
