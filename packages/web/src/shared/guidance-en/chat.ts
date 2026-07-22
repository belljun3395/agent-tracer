import {
  createGuidanceMessage,
} from "~web/shared/guidance-message.js";

export const EN_CHAT = {
  workspaceIntroduction: createGuidanceMessage(
    "Ask the agent about your tasks, rules, memos, and recipes, or have it make changes on your behalf.",
  ),
  loadError: createGuidanceMessage(
    "Check the monitor server connection.",
  ),
  threadsEmpty: createGuidanceMessage(
    "No conversations yet. Start one with New thread.",
  ),
  conversationEmpty: createGuidanceMessage(
    "Send a message to start this conversation.",
  ),
  selectThread: createGuidanceMessage(
    "Select a conversation or start a new one.",
  ),
  streamError: createGuidanceMessage(
    "The conversation stream ended unexpectedly. Try sending again.",
  ),
  confirmDescription: createGuidanceMessage(
    "The agent proposed a change that writes data. Approve to run it, or reject to leave it undone.",
  ),
  memoryUpdated: createGuidanceMessage(
    "The agent remembered this for future conversations.",
  ),
  deleteConfirm: createGuidanceMessage(
    "This deletes the conversation and all of its messages for good. This can't be undone.",
  ),
  thinking: createGuidanceMessage("Thinking…"),
  toolRunning: createGuidanceMessage("Running"),
  queuedToSend: createGuidanceMessage("Queued"),
} as const;
