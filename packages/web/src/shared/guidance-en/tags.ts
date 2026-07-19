import { createGuidanceMessage } from "~web/shared/guidance-message.js";

export const EN_TAGS = {
  workspaceIntroduction: createGuidanceMessage(
    "Labels attached to tasks for classification, visible to every operator watching this workspace.",
  ),
  loadError: createGuidanceMessage("Check the monitor server connection."),
  workspaceEmpty: createGuidanceMessage(
    "No tags yet. Create one to start classifying tasks.",
  ),
  createDescription: createGuidanceMessage(
    "Pick a name and color to create a new tag.",
  ),
  editDescription: createGuidanceMessage(
    "Update the tag's name, color, and description.",
  ),
  deleteDescription: createGuidanceMessage(
    "The tag is deleted and detached from every task it was on once you confirm.",
  ),
  taskAssignDescription: createGuidanceMessage(
    "Pick tags for this task, or create a new one.",
  ),
  filterDescription: createGuidanceMessage(
    "Only tasks carrying every selected tag remain.",
  ),
} as const;
