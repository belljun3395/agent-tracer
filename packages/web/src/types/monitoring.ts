import type { TimelineEventPaths } from "./paths.js";
import type { TimelineEventSemantic } from "./classification.js";

// Branded string types (lightweight, no import needed)
export type TaskId = string & { readonly __brand: 'TaskId' }
export type SessionId = string & { readonly __brand: 'SessionId' }
export type EventId = string & { readonly __brand: 'EventId' }
export type BookmarkId = string & { readonly __brand: 'BookmarkId' }
export type RuleId = string & { readonly __brand: 'RuleId' }
export type GoalId = string & { readonly __brand: 'GoalId' }
export type HandoffId = string & { readonly __brand: 'HandoffId' }
export type PlanId = string & { readonly __brand: 'PlanId' }
export type WorkItemId = string & { readonly __brand: 'WorkItemId' }
export type RuntimeSessionId = string & { readonly __brand: 'RuntimeSessionId' }
export type RuntimeSource = string & { readonly __brand: 'RuntimeSource' }
export type WorkspacePath = string & { readonly __brand: 'WorkspacePath' }
export type TaskSlug = string & { readonly __brand: 'TaskSlug' }

function brand<T extends string>(value: string): string & { readonly __brand: T } {
  return value.trim() as string & { readonly __brand: T }
}

export const TaskId = (value: string): TaskId => brand<'TaskId'>(value)
export const SessionId = (value: string): SessionId => brand<'SessionId'>(value)
export const EventId = (value: string): EventId => brand<'EventId'>(value)
export const BookmarkId = (value: string): BookmarkId => brand<'BookmarkId'>(value)
export const RuleId = (value: string): RuleId => brand<'RuleId'>(value)
export const GoalId = (value: string): GoalId => brand<'GoalId'>(value)
export const HandoffId = (value: string): HandoffId => brand<'HandoffId'>(value)
export const PlanId = (value: string): PlanId => brand<'PlanId'>(value)
export const WorkItemId = (value: string): WorkItemId => brand<'WorkItemId'>(value)
export const RuntimeSessionId = (value: string): RuntimeSessionId => brand<'RuntimeSessionId'>(value)
export const RuntimeSource = (value: string): RuntimeSource => brand<'RuntimeSource'>(value)
export const WorkspacePath = (value: string): WorkspacePath => brand<'WorkspacePath'>(value)
export const TaskSlug = (value: string): TaskSlug => brand<'TaskSlug'>(value)

export type TimelineLane =
  | 'user' | 'exploration' | 'planning' | 'implementation'
  | 'questions' | 'todos' | 'background' | 'coordination' | 'telemetry'

export type MonitoringEventKind =
  | 'task.start' | 'task.complete' | 'task.error' | 'session.ended'
  | 'plan.logged' | 'action.logged' | 'agent.activity.logged'
  | 'verification.logged' | 'rule.logged' | 'tool.used' | 'terminal.command'
  | 'context.saved' | 'file.changed' | 'thought.logged' | 'user.message'
  | 'question.logged' | 'todo.logged' | 'assistant.response'
  | 'instructions.loaded' | 'context.snapshot'

export type MonitoringTaskKind = 'primary' | 'background'

export interface MonitoringTask {
  readonly id: TaskId
  readonly title: string
  readonly slug: TaskSlug
  readonly workspacePath?: WorkspacePath
  readonly status: 'running' | 'waiting' | 'completed' | 'errored'
  readonly taskKind?: MonitoringTaskKind
  readonly parentTaskId?: TaskId
  readonly createdAt: string
  readonly updatedAt: string
  readonly lastSessionStartedAt?: string
  readonly runtimeSource?: RuntimeSource
  readonly displayTitle?: string
}

export interface MonitoringSession {
  readonly id: SessionId
  readonly taskId: TaskId
  readonly status: 'running' | 'completed' | 'errored'
  readonly summary?: string
  readonly startedAt: string
  readonly endedAt?: string
}

export interface EventClassification {
  readonly lane: TimelineLane
  readonly tags: readonly string[]
  readonly matches: readonly EventClassificationMatch[]
}

export interface EventClassificationMatch {
  readonly ruleId: string
  readonly source?: 'action-registry'
  readonly score: number
  readonly lane?: TimelineLane
  readonly tags: readonly string[]
  readonly reasons: readonly EventClassificationReason[]
}

export interface EventClassificationReason {
  readonly kind: 'keyword' | 'action-prefix' | 'action-keyword'
  readonly value: string
}

export interface TimelineEventRecord {
  readonly id: EventId
  readonly taskId: TaskId
  readonly sessionId?: SessionId
  readonly kind: MonitoringEventKind
  readonly lane: TimelineLane
  readonly title: string
  readonly body?: string
  readonly metadata: Record<string, unknown>
  readonly semantic?: TimelineEventSemantic
  readonly paths?: TimelineEventPaths
  readonly classification: EventClassification
  readonly createdAt: string
}
