import {
  createGuidanceMessage,
  guidanceCode,
} from "~web/shared/guidance-message.js";

export const EN_COMMON = {
  guidanceUnavailable: createGuidanceMessage(
    "Guidance is not available for this view yet.",
  ),
  runCommandToContinue: (command: string) =>
    createGuidanceMessage(
      "Run ",
      guidanceCode(command),
      " to continue.",
    ),
  status: {
    running: createGuidanceMessage("The agent is actively producing events."),
    waiting: createGuidanceMessage("The agent is paused for user input."),
    done: createGuidanceMessage("The task completed successfully."),
    failed: createGuidanceMessage("The task ended with an error."),
    idle: createGuidanceMessage("No recent activity was recorded."),
    canceled: createGuidanceMessage("The job stopped before completion."),
  },
} as const;

export const EN_APP = {
  crashRecovery: createGuidanceMessage(
    "Reloading recovers in most cases. If the error is reproducible, copy the message above into a bug report. The operator URL and message are usually enough to diagnose it.",
  ),
  noTaskSelected: createGuidanceMessage(
    "Each task collects every agent action in time order. Open one to follow it as it runs.",
  ),
  taskNotFound: createGuidanceMessage(
    "It may have been deleted in another tab, or the link may point to a stale ID.",
  ),
  taskServerUnavailable: createGuidanceMessage(
    "The monitor server did not respond. Check that it is running on the configured port, then try again.",
  ),
  eventsPending: createGuidanceMessage(
    "Events will appear here as the agent runs.",
  ),
} as const;

export const EN_SHELL = {
  shortcutToggle: createGuidanceMessage(
    "Press ",
    guidanceCode("?"),
    " at any time to toggle this panel.",
  ),
  shortcuts: {
    focusSearch: createGuidanceMessage("Focus the sidebar search input."),
    nextTask: createGuidanceMessage("Move to the next task."),
    previousTask: createGuidanceMessage("Move to the previous task."),
    rulesPage: createGuidanceMessage("Open the workspace Rules page."),
    dismiss: createGuidanceMessage("Clear search or dismiss the open drawer."),
    showPanel: createGuidanceMessage("Show or hide this shortcuts panel."),
  },
  websocketDisconnected: createGuidanceMessage(
    "The dashboard is not receiving WebSocket events. Updates resume when the monitor server returns.",
  ),
  websocketConnected: createGuidanceMessage(
    "Connected to the monitor WebSocket. Task and event updates are streaming in real time.",
  ),
} as const;
