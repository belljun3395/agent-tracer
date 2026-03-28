export const USER_MESSAGE_CONTRACT_VERSION = "1" as const;

export const TRACE_METADATA_KEYS = {
  questionId: "questionId",
  questionPhase: "questionPhase",
  todoId: "todoId",
  todoState: "todoState",
  sequence: "sequence",
  parentEventId: "parentEventId",
  relatedEventIds: "relatedEventIds",
  relationType: "relationType",
  relationLabel: "relationLabel",
  relationExplanation: "relationExplanation",
  activityType: "activityType",
  agentName: "agentName",
  skillName: "skillName",
  skillPath: "skillPath",
  modelName: "modelName",
  modelProvider: "modelProvider",
  mcpServer: "mcpServer",
  mcpTool: "mcpTool"
} as const;
