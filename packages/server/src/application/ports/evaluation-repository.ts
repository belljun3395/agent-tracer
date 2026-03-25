/**
 * @module application/ports/evaluation-repository
 *
 * 태스크 평가 및 워크플로우 검색 포트 인터페이스.
 */

import type { TaskEvaluation, WorkflowSearchResult } from "@monitor/core";

export type { TaskEvaluation, WorkflowSearchResult };

export interface IEvaluationRepository {
  upsertEvaluation(evaluation: TaskEvaluation): Promise<void>;
  getEvaluation(taskId: string): Promise<TaskEvaluation | null>;
  searchSimilarWorkflows(query: string, tags?: readonly string[], limit?: number): Promise<readonly WorkflowSearchResult[]>;
}
