import { useCallback, useEffect, useState } from "react";
import { TaskId } from "../types.js";
import { fetchTaskEvaluation, saveTaskEvaluation } from "../io.js";
import type { TaskEvaluationPayload, TaskEvaluationRecord } from "../io.js";
export interface UseEvaluationResult {
    readonly evaluation: TaskEvaluationRecord | null;
    readonly isLoading: boolean;
    readonly isSaving: boolean;
    readonly isSaved: boolean;
    readonly saveEvaluation: (payload: TaskEvaluationPayload) => Promise<void>;
}
export function useEvaluation(taskId: string | null | undefined, scopeKey?: string): UseEvaluationResult {
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
        void fetchTaskEvaluation(TaskId(taskId), scopeKey)
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
    }, [scopeKey, taskId]);
    const saveEvaluation = useCallback(async (payload: TaskEvaluationPayload): Promise<void> => {
        if (!taskId) {
            return;
        }
        setIsSaving(true);
        try {
            await saveTaskEvaluation(TaskId(taskId), payload, scopeKey);
            setEvaluation({
                taskId: TaskId(taskId),
                scopeKey: evaluation?.scopeKey ?? scopeKey ?? "task",
                scopeKind: evaluation?.scopeKind ?? (scopeKey && scopeKey !== "task" ? "turn" : "task"),
                scopeLabel: evaluation?.scopeLabel ?? (scopeKey === "last-turn" ? "Last turn" : scopeKey?.startsWith("turn:") ? `Turn ${scopeKey.slice("turn:".length)}` : "Whole task"),
                turnIndex: evaluation?.turnIndex ?? (scopeKey?.startsWith("turn:") ? Number.parseInt(scopeKey.slice("turn:".length), 10) || null : null),
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
    }, [evaluation, scopeKey, taskId]);
    return { evaluation, isLoading, isSaving, isSaved, saveEvaluation };
}
