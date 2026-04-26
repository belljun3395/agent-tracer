import { defineEventType, optionalArray, optionalString, requireString } from "./definition/event.definition.js";

export const WORKFLOW_EVENT_DEFINITIONS = [
    defineEventType("playbook.drafted", (payload) => {
        requireString(payload, "playbook_id");
        requireString(payload, "title");
        requireString(payload, "slug");
        optionalArray(payload, "source_evaluation_refs");
    }),
    defineEventType("playbook.published", (payload) => {
        requireString(payload, "playbook_id");
        optionalString(payload, "version");
    }),
    defineEventType("playbook.used", (payload) => {
        requireString(payload, "playbook_id");
        requireString(payload, "task_id");
    }),
    defineEventType("briefing.generated", (payload) => {
        requireString(payload, "briefing_id");
        requireString(payload, "task_id");
        requireString(payload, "purpose");
        requireString(payload, "format");
        optionalString(payload, "content_ref");
    }),
] as const;

export type WorkflowEventType = (typeof WORKFLOW_EVENT_DEFINITIONS)[number]["eventType"];
