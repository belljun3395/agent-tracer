import type { EventClassification } from "../classification/types.js";
import type { EventId, RuntimeSource, SessionId, TaskId, TaskSlug, WorkspacePath } from "./ids.js";

export type TimelineLane = "user" | "exploration" | "planning" | "implementation" | "questions" | "todos" | "background" | "coordination";
export type MonitoringEventKind = "task.start" | "task.complete" | "task.error" | "session.ended" | "plan.logged" | "action.logged" | "agent.activity.logged" | "verification.logged" | "rule.logged" | "tool.used" | "terminal.command" | "context.saved" | "file.changed" | "thought.logged" | "user.message" | "question.logged" | "todo.logged" | "assistant.response" | "instructions.loaded";
export type MonitoringTaskKind = "primary" | "background";

export interface MonitoringTaskInput {
    readonly title: string;
    readonly workspacePath?: WorkspacePath;
    readonly taskKind?: MonitoringTaskKind;
    readonly parentTaskId?: TaskId;
    readonly parentSessionId?: SessionId;
    readonly backgroundTaskId?: TaskId;
}

export interface MonitoringTask extends MonitoringTaskInput {
    readonly id: TaskId;
    readonly slug: TaskSlug;
    readonly displayTitle?: string;
    readonly status: "running" | "waiting" | "completed" | "errored";
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastSessionStartedAt?: string;
    readonly runtimeSource?: RuntimeSource;
    readonly taskKind?: MonitoringTaskKind;
}

export interface MonitoringSession {
    readonly id: SessionId;
    readonly taskId: TaskId;
    readonly status: "running" | "completed" | "errored";
    readonly summary?: string;
    readonly startedAt: string;
    readonly endedAt?: string;
}

export interface TimelineEvent {
    readonly id: EventId;
    readonly taskId: TaskId;
    readonly sessionId?: SessionId;
    readonly kind: MonitoringEventKind;
    readonly lane: TimelineLane;
    readonly title: string;
    readonly body?: string;
    readonly metadata: Record<string, unknown>;
    readonly classification: EventClassification;
    readonly createdAt: string;
}

export type EventRelationType = "implements" | "revises" | "verifies" | "answers" | "delegates" | "returns" | "completes" | "blocks" | "caused_by" | "relates_to";
export type AgentActivityType = "agent_step" | "mcp_call" | "skill_use" | "delegation" | "handoff" | "bookmark" | "search";
