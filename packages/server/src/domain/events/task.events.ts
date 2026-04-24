import { defineEventType, optionalString, requireString } from "./event.type.js";

export const TASK_EVENT_DEFINITIONS = [
    defineEventType("task.created", (payload) => {
        requireString(payload, "task_id");
        requireString(payload, "title");
        requireString(payload, "slug");
        requireString(payload, "kind");
        optionalString(payload, "parent_task_id");
        optionalString(payload, "parent_session_id");
        optionalString(payload, "background_task_id");
        optionalString(payload, "workspace_path");
        optionalString(payload, "cli_source");
    }),
    defineEventType("task.renamed", (payload) => {
        requireString(payload, "task_id");
        requireString(payload, "from");
        requireString(payload, "to");
    }),
    defineEventType("task.status_changed", (payload) => {
        requireString(payload, "task_id");
        requireString(payload, "from");
        requireString(payload, "to");
        optionalString(payload, "reason");
    }),
    defineEventType("task.hierarchy_changed", (payload) => {
        requireString(payload, "task_id");
        optionalString(payload, "parent_task_id_from");
        optionalString(payload, "parent_task_id_to");
        optionalString(payload, "parent_session_id_from");
        optionalString(payload, "parent_session_id_to");
        optionalString(payload, "background_task_id_from");
        optionalString(payload, "background_task_id_to");
    }),
] as const;

export type TaskEventType = (typeof TASK_EVENT_DEFINITIONS)[number]["eventType"];
