import { createGuidanceMessage } from "~web/shared/guidance-message.js";

export const EN_MEMOS = {
  workspaceIntroduction: createGuidanceMessage(
    "Notes attached to tasks or individual events, visible to every operator watching this workspace.",
  ),
  loadError: createGuidanceMessage("Check the monitor server connection."),
  workspaceEmpty: createGuidanceMessage(
    "No memos yet. Open a task and add one to start a thread.",
  ),
  taskThreadEmpty: createGuidanceMessage(
    "No memos on this task yet. Add one below.",
  ),
  eventThreadEmpty: createGuidanceMessage(
    "No memos on this event yet. Add one below.",
  ),
  editDescription: createGuidanceMessage("Update the memo body."),
  deleteDescription: createGuidanceMessage(
    "The memo is removed permanently once you confirm.",
  ),
} as const;
