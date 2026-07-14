import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { TaskId } from "~web/shared/identity.js";
import type { RulesListResponse } from "~web/entities/rule/model/rule.js";
import type { RuleEvidenceResponse } from "~web/entities/rule/model/rule-evidence.js";
import {
  fetchRuleEvidence,
  fetchRules,
  fetchTaskRules,
} from "~web/entities/rule/api/api-rules.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

export function useRulesQuery(): UseQueryResult<RulesListResponse> {
  return useQuery({
    queryKey: monitorQueryKeys.rules(),
    queryFn: fetchRules,
  });
}

export function useTaskRulesQuery(
  taskId: TaskId | null,
  options?: { readonly enabled?: boolean },
): UseQueryResult<RulesListResponse> {
  return useQuery({
    queryKey: taskId
      ? monitorQueryKeys.taskRules(taskId)
      : monitorQueryKeys.taskRules("__disabled__" as TaskId),
    queryFn: () => {
      if (!taskId) {
        throw new Error("useTaskRulesQuery called without a taskId");
      }
      return fetchTaskRules(taskId);
    },
    enabled: taskId !== null && (options?.enabled ?? true),
  });
}

export function useRuleEvidenceQuery(
  taskId: TaskId | null,
  ruleId: string | null,
  options?: { readonly enabled?: boolean },
): UseQueryResult<RuleEvidenceResponse> {
  return useQuery({
    queryKey:
      taskId && ruleId
        ? monitorQueryKeys.ruleEvidence(taskId, ruleId)
        : monitorQueryKeys.ruleEvidence("__disabled__" as TaskId, "__disabled__"),
    queryFn: () => {
      if (!taskId || !ruleId) {
        throw new Error("useRuleEvidenceQuery called without taskId/ruleId");
      }
      return fetchRuleEvidence(taskId, ruleId);
    },
    enabled: taskId !== null && ruleId !== null && (options?.enabled ?? true),
  });
}
