/**
 * 태스크 평가 상태 훅.
 * 마운트 시 기존 평가를 조회하고, saveEvaluation으로 저장.
 */

import { useCallback, useEffect, useState } from "react";
import { fetchTaskEvaluation, saveTaskEvaluation } from "../api.js";
import type { TaskEvaluationPayload, TaskEvaluationRecord } from "../api.js";

export interface UseEvaluationResult {
  readonly evaluation: TaskEvaluationRecord | null;
  readonly isLoading: boolean;
  readonly isSaving: boolean;
  readonly isSaved: boolean;
  readonly saveEvaluation: (payload: TaskEvaluationPayload) => Promise<void>;
}

export function useEvaluation(taskId: string | null | undefined): UseEvaluationResult {
  const [evaluation, setEvaluation] = useState<TaskEvaluationRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (!taskId) {
      setEvaluation(null);
      setIsLoading(false);
      setIsSaving(false);
      setIsSaved(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setIsSaved(false);
    void fetchTaskEvaluation(taskId)
      .then((record) => {
        if (isActive) {
          setEvaluation(record);
          setIsSaved(false);
        }
      })
      .catch(() => {
        if (isActive) {
          setEvaluation(null);
          setIsSaved(false);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [taskId]);

  const saveEvaluation = useCallback(async (payload: TaskEvaluationPayload): Promise<void> => {
    if (!taskId) {
      return;
    }

    setIsSaving(true);
    try {
      await saveTaskEvaluation(taskId, payload);
      setEvaluation({
        taskId,
        ...payload,
        workflowTags: payload.workflowTags ?? [],
        useCase: payload.useCase ?? null,
        outcomeNote: payload.outcomeNote ?? null,
        approachNote: payload.approachNote ?? null,
        reuseWhen: payload.reuseWhen ?? null,
        watchouts: payload.watchouts ?? null,
        evaluatedAt: new Date().toISOString()
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } finally {
      setIsSaving(false);
    }
  }, [taskId]);

  return { evaluation, isLoading, isSaving, isSaved, saveEvaluation };
}
