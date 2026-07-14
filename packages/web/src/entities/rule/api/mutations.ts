import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TaskId } from "~web/shared/identity.js";
import type { RuleCreateInput, RuleUpdateInput } from "~web/entities/rule/model/rule.js";
import {
  approveRule,
  createRule,
  deleteRule,
  reEvaluateRule,
  updateRule,
} from "~web/entities/rule/api/api-rules.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

export function useApproveRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => approveRule(ruleId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.rules() });
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.taskScopedPrefix() });
    },
  });
}

export function useDeleteRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => deleteRule(ruleId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.rules() });
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.taskScopedPrefix() });
    },
  });
}

export function useCreateRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RuleCreateInput) => createRule(body),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.rules() });
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.taskScopedPrefix() });
    },
  });
}

export function useUpdateRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, body }: { readonly ruleId: string; readonly body: RuleUpdateInput }) =>
      updateRule(ruleId, body),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.rules() });
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.taskScopedPrefix() });
    },
  });
}

export function useReEvaluateRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId }: { readonly ruleId: string; readonly taskId: TaskId }) =>
      reEvaluateRule(ruleId),
    onSettled: (_data, _err, variables) => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.taskDetail(variables.taskId) });
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.taskRules(variables.taskId) });
    },
  });
}
