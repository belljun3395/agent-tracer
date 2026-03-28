/**
 * @module application/ports/evaluation-repository
 *
 * 태스크 평가 및 워크플로우 검색 포트 인터페이스.
 */

import type {
  ReusableTaskSnapshot,
  TaskEvaluation,
  WorkflowSearchResult,
  WorkflowSummary
} from "@monitor/core";

export type { TaskEvaluation, WorkflowSearchResult, WorkflowSummary };

export interface StoredTaskEvaluation extends TaskEvaluation {
  readonly workflowSnapshot: ReusableTaskSnapshot | null;
  readonly workflowContext: string | null;
  readonly searchText: string | null;
}

export interface WorkflowContentRecord {
  readonly taskId: string;
  readonly title: string;
  readonly displayTitle?: string;
  readonly workflowSnapshot: ReusableTaskSnapshot;
  readonly workflowContext: string;
  readonly searchText: string | null;
  readonly source: "saved" | "generated";
}

export interface PersistedTaskEvaluation extends TaskEvaluation {
  readonly workflowSnapshot?: ReusableTaskSnapshot | null;
  readonly workflowContext?: string | null;
  readonly searchText?: string | null;
}

export interface IEvaluationRepository {
  upsertEvaluation(evaluation: PersistedTaskEvaluation): Promise<void>;
  getEvaluation(taskId: string): Promise<StoredTaskEvaluation | null>;
  getWorkflowContent(taskId: string): Promise<WorkflowContentRecord | null>;
  listEvaluations(rating?: "good" | "skip"): Promise<readonly WorkflowSummary[]>;
  searchWorkflowLibrary(query: string, rating?: "good" | "skip", limit?: number): Promise<readonly WorkflowSummary[]>;
  searchSimilarWorkflows(query: string, tags?: readonly string[], limit?: number): Promise<readonly WorkflowSearchResult[]>;
}
