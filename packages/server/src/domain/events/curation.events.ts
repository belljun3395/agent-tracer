import { defineEventType, optionalArray, optionalNumber, optionalObject, optionalString, requireNumber, requireString } from "./event.type.js";

export const CURATION_EVENT_DEFINITIONS = [
    defineEventType("bookmark.added", (payload) => {
        requireString(payload, "task_id");
        requireString(payload, "bookmark_id");
        optionalString(payload, "event_id_ref");
        requireString(payload, "kind");
        requireString(payload, "title");
        optionalString(payload, "note");
        optionalObject(payload, "metadata");
    }),
    defineEventType("bookmark.removed", (payload) => {
        requireString(payload, "bookmark_id");
    }),
    defineEventType("evaluation.recorded", (payload) => {
        requireString(payload, "task_id");
        requireString(payload, "scope_key");
        requireString(payload, "scope_kind");
        optionalNumber(payload, "turn_index");
        requireString(payload, "rating");
        optionalObject(payload, "workflow_data");
    }),
    defineEventType("evaluation.reused", (payload) => {
        requireString(payload, "task_id");
        requireString(payload, "scope_key");
        optionalString(payload, "target_context");
    }),
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
