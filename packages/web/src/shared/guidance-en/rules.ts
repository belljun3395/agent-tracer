import {
  createGuidanceMessage,
  guidanceCode,
} from "~web/shared/guidance-message.js";

export const EN_RULES = {
  workspaceIntroduction: createGuidanceMessage(
    "Create and maintain checks that evaluate agent events across the workspace.",
  ),
  loadError: createGuidanceMessage(
    "Check the monitor server connection.",
  ),
  emptyTask: createGuidanceMessage(
    "Add a rule to start enforcing checks against this task.",
  ),
  workspaceEmpty: createGuidanceMessage(
    "No rules are configured yet. Create the first rule above.",
  ),
  editDescription: createGuidanceMessage(
    "Update the rule expectation, severity, or rationale.",
  ),
  newTaskDescription: createGuidanceMessage(
    "Define a new check that runs against this task's events.",
  ),
  newWorkspaceDescription: createGuidanceMessage(
    "Define a new check that runs against agent events.",
  ),
  form: {
    nameRequired: createGuidanceMessage("Enter a rule name."),
    expectationRequired: createGuidanceMessage(
      "Fill in the fields the selected kind requires.",
    ),
    anchor: createGuidanceMessage(
      "The user input this rule verifies. Fulfilment is judged from what the agent did after that input.",
    ),
    anchorRequired: createGuidanceMessage(
      "Choose the user input this rule verifies.",
    ),
    expectation: createGuidanceMessage(
      "Describe what the agent must do to fulfil the user's request. Kind selects the field combination below.",
    ),
    kind: createGuidanceMessage(
      "The expectation shape. command matches literal commands, pattern matches a regex, action checks only the tool category.",
    ),
    toolName: createGuidanceMessage(
      "Required for action, optional for pattern where it narrows the call checked.",
    ),
    commandMatches: createGuidanceMessage(
      "Enter one expected command substring per line.",
    ),
    pattern: createGuidanceMessage(
      "Regular expression applied to the event payload.",
    ),
    rationale: createGuidanceMessage(
      "Explain why this rule exists. The rationale appears on violation cards.",
    ),
  },
  generation: {
    introduction: createGuidanceMessage(
      "Run a Claude Agent SDK pass over this task's workspace and timeline to propose verification rules. Generated rules are saved with ",
      guidanceCode("source=agent"),
      " and ",
      guidanceCode("severity=info"),
      ".",
    ),
    incompleteTimeline: (status: string) =>
      createGuidanceMessage(
        "The task status is ",
        guidanceCode(status),
        ", so its timeline may be incomplete.",
      ),
    anchorHelp: createGuidanceMessage(
      "Rules are generated from this input and checked against everything the agent does after it. One input can produce several rules.",
    ),
    intentHelp: createGuidanceMessage(
      "Optionally describe what the rules should verify. Leave this empty to scan the entire task.",
    ),
  },
  feedback: {
    prompt: createGuidanceMessage("How useful was this rule?"),
    saveFailed: createGuidanceMessage("The rating could not be saved."),
    saved: createGuidanceMessage("Rating saved."),
  },
  evidence: {
    loading: createGuidanceMessage("Loading rule evidence…"),
    unavailable: createGuidanceMessage(
      "Evidence for this rule could not be loaded.",
    ),
    empty: createGuidanceMessage(
      "No events on this task have matched the rule yet.",
    ),
    unfulfilled: createGuidanceMessage(
      "The expected action did not occur after the user's request.",
    ),
    matchedTrigger: createGuidanceMessage(
      "The user input this rule came from.",
    ),
    matchedCondition: (condition: string) =>
      createGuidanceMessage(
        "Matched the rule's ",
        guidanceCode(condition),
        " condition.",
      ),
  },
} as const;

export const EN_RECIPES = {
  introduction: createGuidanceMessage(
    "Reusable patterns distilled from completed tasks. Every candidate requires review before it becomes an active recipe that future agents can use.",
  ),
  candidatesEmpty: createGuidanceMessage(
    "No candidates are waiting for review. Scan a completed task to extract reusable patterns.",
  ),
  activeEmpty: createGuidanceMessage(
    "No active recipes yet. Accept a candidate to add one.",
  ),
  archiveEmpty: createGuidanceMessage(
    "Retired and superseded recipes appear in this archive.",
  ),
  completedTasksEmpty: createGuidanceMessage(
    "No completed tasks are available. Finish a task, then scan it.",
  ),
  taskSearchEmpty: (query: string) =>
    createGuidanceMessage(
      "No completed task matches ",
      guidanceCode(query),
      ".",
    ),
  deleteDescription: createGuidanceMessage(
    "The recipe is removed from the archive. Its application history remains available for metrics.",
  ),
  editDescription: createGuidanceMessage(
    "Future agent updates to a user-edited recipe arrive as review candidates.",
  ),
} as const;

export const EN_INSPECTOR = {
  selectAction: createGuidanceMessage(
    "Select a timeline card to inspect its complete payload.",
  ),
  traceLoadError: createGuidanceMessage(
    "Check the monitor server connection or select another task.",
  ),
  tracePending: createGuidanceMessage(
    "Spans will appear here as the agent runs.",
  ),
  spanKinds: {
    llm: createGuidanceMessage("Model call: a prompt sent to the language model."),
    tool: createGuidanceMessage("Tool call: an action such as Bash or Edit."),
    agent: createGuidanceMessage("Subagent delegation: work handed to another agent."),
    retriever: createGuidanceMessage("Retrieval from a document or memory store."),
    chain: createGuidanceMessage("Workflow step that groups one or more child spans."),
    unknown: createGuidanceMessage("Context, notification, or other telemetry event."),
  },
} as const;
