import { useCallback, useEffect, useState } from "react";
import { TaskId } from "@monitor/core";
import { fetchTaskEvaluation, saveTaskEvaluation } from "@monitor/web-io";
import type { TaskEvaluationPayload, TaskEvaluationRecord } from "@monitor/web-io";
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
        void fetchTaskEvaluation(TaskId(taskId))
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
            await saveTaskEvaluation(TaskId(taskId), payload);
            setEvaluation({
                taskId: TaskId(taskId),
                ...payload,
                workflowTags: payload.workflowTags ?? [],
                useCase: payload.useCase ?? null,
                outcomeNote: payload.outcomeNote ?? null,
                approachNote: payload.approachNote ?? null,
                reuseWhen: payload.reuseWhen ?? null,
                watchouts: payload.watchouts ?? null,
                workflowSnapshot: payload.workflowSnapshot ?? null,
                workflowContext: payload.workflowContext ?? null,
                searchText: payload.workflowSnapshot?.searchText ?? null,
                version: (evaluation?.version ?? 0) + 1,
                promotedTo: evaluation?.promotedTo ?? null,
                qualitySignals: evaluation?.qualitySignals ?? {
                    reuseCount: 0,
                    lastReusedAt: null,
                    briefingCopyCount: 0,
                    manualRating: payload.rating
                },
                evaluatedAt: new Date().toISOString()
            });
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2500);
        }
        finally {
            setIsSaving(false);
        }
    }, [taskId]);
    return { evaluation, isLoading, isSaving, isSaved, saveEvaluation };
}
