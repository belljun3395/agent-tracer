export type TimelineLane =
  | "user"
  | "exploration"
  | "planning"
  | "implementation"
  | "questions"
  | "todos"
  | "background"
  | "coordination";

export type MonitoringEventKind =
  | "task.start"
  | "task.complete"
  | "task.error"
  | "plan.logged"
  | "action.logged"
  | "agent.activity.logged"
  | "verification.logged"
  | "rule.logged"
  | "tool.used"
  | "terminal.command"
  | "context.saved"
  | "file.changed"
  | "thought.logged"
  | "user.message"
  | "question.logged"
  | "todo.logged"
  | "assistant.response";

export type MonitoringTaskKind = "primary" | "background";

export interface MonitoringTaskInput {
  readonly title: string;
  readonly workspacePath?: string;
  readonly taskKind?: MonitoringTaskKind;
  readonly parentTaskId?: string;
  readonly parentSessionId?: string;
  readonly backgroundTaskId?: string;
}

export interface MonitoringTask extends MonitoringTaskInput {
  readonly id: string;
  readonly slug: string;
  readonly displayTitle?: string;
  readonly status: "running" | "waiting" | "completed" | "errored";
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastSessionStartedAt?: string;
  readonly runtimeSource?: string;
  readonly taskKind?: MonitoringTaskKind;
}

export interface MonitoringSession {
  readonly id: string;
  readonly taskId: string;
  readonly status: "running" | "completed" | "errored";
  readonly summary?: string;
  readonly startedAt: string;
  readonly endedAt?: string;
}

export interface EventClassificationReason {
  readonly kind: "keyword" | "action-prefix" | "action-keyword";
  readonly value: string;
}

export interface EventClassificationMatch {
  readonly ruleId: string;
  readonly source?: "action-registry";
  readonly score: number;
  readonly lane?: TimelineLane;
  readonly tags: readonly string[];
  readonly reasons: readonly EventClassificationReason[];
}

export interface EventClassification {
  readonly lane: TimelineLane;
  readonly tags: readonly string[];
  readonly matches: readonly EventClassificationMatch[];
}

export interface TimelineEvent {
  readonly id: string;
  readonly taskId: string;
  readonly sessionId?: string;
  readonly kind: MonitoringEventKind;
  readonly lane: TimelineLane;
  readonly title: string;
  readonly body?: string;
  readonly metadata: Record<string, unknown>;
  readonly classification: EventClassification;
  readonly createdAt: string;
}

export type EventRelationType =
  | "implements"
  | "revises"
  | "verifies"
  | "answers"
  | "delegates"
  | "returns"
  | "completes"
  | "blocks"
  | "caused_by"
  | "relates_to";

export type AgentActivityType =
  | "agent_step"
  | "mcp_call"
  | "skill_use"
  | "delegation"
  | "handoff"
  | "bookmark"
  | "search";

export interface TaskEvaluation {
  readonly taskId: string;
  readonly rating: "good" | "skip";
  readonly useCase: string | null;
  readonly workflowTags: readonly string[];
  readonly outcomeNote: string | null;
  readonly evaluatedAt: string;
}

export interface WorkflowSummary {
  readonly taskId: string;
  readonly title: string;
  readonly useCase: string | null;
  readonly workflowTags: readonly string[];
  readonly outcomeNote: string | null;
  readonly rating: "good" | "skip";
  readonly eventCount: number;
  readonly createdAt: string;
  readonly evaluatedAt: string;
}

export interface WorkflowSearchResult {
  readonly taskId: string;
  readonly title: string;
  readonly useCase: string | null;
  readonly workflowTags: readonly string[];
  readonly outcomeNote: string | null;
  readonly rating: string;
  readonly eventCount: number;
  readonly createdAt: string;
  readonly workflowContext: string;
}

export type QuestionPhase = "asked" | "answered" | "concluded";

export type TodoState = "added" | "in_progress" | "completed" | "cancelled";
