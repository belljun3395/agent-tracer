import type { TaskId } from './monitoring.js'

export type WorkflowLayer = 'snapshot'
export type QuestionPhase = 'asked' | 'answered' | 'concluded'
export type TodoState = 'added' | 'in_progress' | 'completed' | 'cancelled'

export interface QualitySignals {
  readonly reuseCount: number
  readonly lastReusedAt: string | null
  readonly manualRating: 'good' | 'skip'
}

export interface WorkflowEvaluationData {
  readonly useCase: string | null
  readonly workflowTags: readonly string[]
  readonly outcomeNote: string | null
  readonly approachNote: string | null
  readonly reuseWhen: string | null
  readonly watchouts: string | null
}

export interface WorkflowSummary extends WorkflowEvaluationData {
  readonly layer: 'snapshot'
  readonly snapshotId: string
  readonly taskId: TaskId
  readonly scopeKey: string
  readonly scopeKind: 'task' | 'turn'
  readonly scopeLabel: string
  readonly turnIndex: number | null
  readonly title: string
  readonly displayTitle?: string
  readonly rating: 'good' | 'skip'
  readonly eventCount: number
  readonly createdAt: string
  readonly evaluatedAt: string
  readonly version: number
  readonly promotedTo: string | null
  readonly qualitySignals: QualitySignals
}

export interface WorkflowSearchResult extends WorkflowEvaluationData {
  readonly layer: 'snapshot'
  readonly snapshotId: string
  readonly taskId: TaskId
  readonly scopeKey: string
  readonly scopeKind: 'task' | 'turn'
  readonly scopeLabel: string
  readonly turnIndex: number | null
  readonly title: string
  readonly displayTitle?: string
  readonly rating: 'good' | 'skip'
  readonly eventCount: number
  readonly createdAt: string
  readonly workflowContext: string
  readonly version: number
  readonly promotedTo: string | null
  readonly qualitySignals: QualitySignals
}

export interface TaskEvaluation extends WorkflowEvaluationData {
  readonly taskId: TaskId
  readonly scopeKey: string
  readonly scopeKind: 'task' | 'turn'
  readonly scopeLabel: string
  readonly turnIndex: number | null
  readonly rating: 'good' | 'skip'
  readonly evaluatedAt: string
}

export interface ReusableTaskSnapshot {
  readonly objective: string
  readonly originalRequest: string | null
  readonly outcomeSummary: string | null
  readonly approachSummary: string | null
  readonly reuseWhen: string | null
  readonly watchItems: readonly string[]
  readonly keyDecisions: readonly string[]
  readonly nextSteps: readonly string[]
  readonly keyFiles: readonly string[]
  readonly modifiedFiles: readonly string[]
  readonly verificationSummary: string | null
  readonly activeInstructions: readonly string[]
  readonly searchText: string
}
