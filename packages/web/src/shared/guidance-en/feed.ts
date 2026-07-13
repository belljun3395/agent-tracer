import {
  createGuidanceMessage,
  guidanceCode,
} from "~web/shared/guidance-message.js";

export const EN_FEED = {
  clickToRename: createGuidanceMessage("Click to rename this task."),
  suggestingTitle: createGuidanceMessage(
    "The agent is reading the task summary…",
  ),
  suggestBetterTitle: createGuidanceMessage(
    "Generate a clearer title from the task summary.",
  ),
  currentTitleFine: createGuidanceMessage(
    "The current title already fits, so no rename was suggested.",
  ),
  wallClock: createGuidanceMessage(
    "Wall-clock time since the task session started.",
  ),
  compactions: createGuidanceMessage(
    "Number of context-window compactions during this task.",
  ),
  contextUsage: createGuidanceMessage(
    "Most recent context-window utilization reported by the status-line script.",
  ),
  graphContext: createGuidanceMessage(
    "Context-window utilization across the task. Dashed lines mark warning (85%) and error (95%) thresholds. The lower strip shows the active model family.",
  ),
  graphNavigation: createGuidanceMessage(
    "Hold Command or Control while scrolling to zoom. Drag the empty canvas to pan.",
  ),
  emptyLanesHidden: (count: number) =>
    createGuidanceMessage(
      `${count} empty ${count === 1 ? "lane is" : "lanes are"} hidden.`,
    ),
  hideEmptyLanes: createGuidanceMessage(
    "Hide lanes that have no events.",
  ),
  lanes: {
    user: createGuidanceMessage("User prompts, replies, and approvals."),
    plan: createGuidanceMessage("Reasoning, intent, and decisions."),
    explore: createGuidanceMessage("File reads, searches, and listings."),
    implement: createGuidanceMessage("File writes, shell commands, and edits."),
    rule: createGuidanceMessage("Enforcement triggers and violations."),
    verify: createGuidanceMessage("Actions confirmed by rule verdicts."),
    coordinate: createGuidanceMessage("Subagent creation and handoffs."),
  },
} as const;

export const EN_TASKS = {
  cleanupIntroduction: createGuidanceMessage(
    "The agent scans the task list for duplicates, stale rows, and abandoned tasks worth archiving. Every suggestion requires approval before it is applied.",
  ),
  cleanupEmpty: createGuidanceMessage(
    "No archive suggestions are pending. Run a scan to look for stale or duplicate tasks.",
  ),
  taskView: createGuidanceMessage("Sessions started by an operator."),
  subagentView: createGuidanceMessage("Jobs started by a server-side agent."),
  attentionFilter: createGuidanceMessage(
    "Tasks waiting for your input or stopped by an error.",
  ),
  shortcutsHint: createGuidanceMessage(
    "Press ",
    guidanceCode("?"),
    " for keyboard shortcuts: j/k navigate, / searches, g opens Rules, and Esc clears.",
  ),
  runtimeCaption: (runtime: string) =>
    createGuidanceMessage(
      "Every task in this list comes from ",
      guidanceCode(runtime),
      ".",
    ),
} as const;
