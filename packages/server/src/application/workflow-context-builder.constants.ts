export const WORKFLOW_CONTEXT_LANES = [
  "exploration",
  "implementation",
  "questions",
  "todos",
  "background",
  "coordination"
] as const;

export const LANE_TITLES: Record<string, string> = {
  user: "User Interactions",
  exploration: "Exploration",
  planning: "Planning",
  implementation: "Implementation",
  questions: "Questions",
  todos: "TODOs",
  background: "Background",
  coordination: "Coordination"
};
