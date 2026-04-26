import { useMutation, useQueryClient, type QueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createRule, deleteRule, promoteRule, reEvaluateRule, updateRule } from "~io/api.js";
import type { RuleId, TaskId } from "~domain/monitoring.js";
import type { BackfillResult, RuleCreateInput, RuleRecord, RuleUpdateInput } from "~domain/rule.js";
import { monitorQueryKeys } from "~state/server/queryKeys.js";

export function invalidateRuleCaches(qc: QueryClient, taskId?: TaskId | null): void {
    void qc.invalidateQueries({ queryKey: ["monitor", "rules"] });
    if (taskId) {
        void qc.invalidateQueries({ queryKey: monitorQueryKeys.taskRules(taskId) });
        void qc.invalidateQueries({ queryKey: monitorQueryKeys.verdictCounts(taskId) });
        void qc.invalidateQueries({ queryKey: monitorQueryKeys.taskDetail(taskId) });
    } else {
        void qc.invalidateQueries({ queryKey: ["monitor", "task"] });
    }
}

export function useCreateRuleMutation(): UseMutationResult<RuleRecord, Error, RuleCreateInput> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input: RuleCreateInput) => createRule(input),
        onSuccess: (rule) => invalidateRuleCaches(qc, rule.taskId ?? null),
    });
}

export function useUpdateRuleMutation(): UseMutationResult<
    { rule: RuleRecord; signatureChanged: boolean },
    Error,
    { id: RuleId; patch: RuleUpdateInput }
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, patch }) => updateRule(id, patch),
        onSuccess: (result) => invalidateRuleCaches(qc, result.rule.taskId ?? null),
    });
}

export function useDeleteRuleMutation(): UseMutationResult<void, Error, { id: RuleId; taskId?: TaskId }> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id }) => deleteRule(id),
        onSuccess: (_, variables) => invalidateRuleCaches(qc, variables.taskId ?? null),
    });
}

export function usePromoteRuleMutation(): UseMutationResult<RuleRecord, Error, { id: RuleId; taskId?: TaskId }> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id }) => promoteRule(id),
        onSuccess: (_, variables) => invalidateRuleCaches(qc, variables.taskId ?? null),
    });
}

export function useReEvaluateRuleMutation(): UseMutationResult<BackfillResult, Error, { id: RuleId; taskId?: TaskId }> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id }) => reEvaluateRule(id),
        onSuccess: (_, variables) => invalidateRuleCaches(qc, variables.taskId ?? null),
    });
}
