/** Korean UI strings used across web-domain. */

// Handoff prompt preambles (per purpose)
export const KO_HANDOFF_PREAMBLE_CONTINUE =
    "You are resuming a task that was in progress. Read the briefing below and pick up where it left off.";
export const KO_HANDOFF_PREAMBLE_HANDOFF =
    "You are taking over a task from another developer. Read the briefing below to understand the current state.";
export const KO_HANDOFF_PREAMBLE_REVIEW =
    "You are reviewing a completed task. Read the briefing below and assess how well the goal was achieved.";
export const KO_HANDOFF_PREAMBLE_REFERENCE =
    "This is a reference workflow from a past task. Use it as a guide when working on similar tasks.";

// Handoff prompt actions (per purpose)
export const KO_HANDOFF_ACTION_CONTINUE =
    "Start with the most urgent incomplete item.";
export const KO_HANDOFF_ACTION_HANDOFF =
    "Confirm the handoff details and decide your first action.";
export const KO_HANDOFF_ACTION_REVIEW =
    "Review the work against the plan and identify any quality issues or improvements.";
export const KO_HANDOFF_ACTION_REFERENCE =
    "Use the monitor_find_similar_workflows MCP tool to search for similar workflows and compare.";

// Evaluate prompt strings
export const KO_EVALUATE_INTRO =
    "Evaluate the completed task and call the monitor_evaluate_task MCP tool to save it to the workflow library.";
export const KO_EVALUATE_INSTRUCTIONS_HEADER =
    "\nCall the monitor_evaluate_task MCP tool using the context above:\n";
export const KO_EVALUATE_FIELD_RATING =
    "- rating: \"good\" if the approach worked well, \"skip\" otherwise";
export const KO_EVALUATE_FIELD_USE_CASE =
    "- useCase: type of task (e.g. \"Fix TypeScript type errors\")";
export const KO_EVALUATE_FIELD_OUTCOME_NOTE =
    "- outcomeNote: summary of what was achieved";
export const KO_EVALUATE_FIELD_APPROACH_NOTE =
    "- approachNote: what approach worked and why";
export const KO_EVALUATE_FIELD_REUSE_WHEN =
    "- reuseWhen: when to reuse this workflow";
export const KO_EVALUATE_FIELD_WATCHOUTS =
    "- watchouts: what to watch out for in similar tasks";
export const KO_EVALUATE_FIELD_WORKFLOW_TAGS =
    "- workflowTags: classification tags (e.g. [\"typescript\", \"refactor\"])";
export const KO_EVALUATE_CALL_NOW =
    "\nCall the tool immediately without asking for confirmation.";

// Timeline UI strings
export const KO_TIMELINE_STACKED_EVENTS = (count: number): string =>
    `${count}개 이벤트 겹침`;
