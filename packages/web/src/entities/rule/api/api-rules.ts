import type { TaskId } from "~web/shared/identity.js";
import type { RuleEvidenceResponse } from "~web/entities/rule/model/rule-evidence.js";
import type {
  RuleCreateInput,
  RuleRecord,
  RuleUpdateInput,
  RulesListResponse,
} from "~web/entities/rule/model/rule.js";
import type { RuleDto } from "@monitor/kernel";
import { deleteRequest, getJson, patchJson, postJson } from "~web/shared/api/client/json-methods.js";
import { toRuleRecord } from "~web/entities/rule/api/rule.mapper.js";

export async function fetchRules(): Promise<RulesListResponse> {
  const res = await getJson<{ readonly items: readonly RuleDto[] }>("/api/v1/rules?all=true");
  return { rules: res.items.map(toRuleRecord) };
}

export async function fetchTaskRules(taskId: TaskId): Promise<RulesListResponse> {
  const res = await getJson<{ readonly items: readonly RuleDto[] }>(`/api/v1/rules?taskId=${taskId}`);
  return { rules: res.items.map(toRuleRecord) };
}

export function fetchRuleEvidence(
  taskId: TaskId,
  ruleId: string,
): Promise<RuleEvidenceResponse> {
  return getJson<RuleEvidenceResponse>(
    `/api/v1/rules/${encodeURIComponent(ruleId)}/evidence?taskId=${taskId}`,
  );
}

export interface DeleteRuleResponse {
  readonly deleted: boolean;
}

export function deleteRule(ruleId: string): Promise<DeleteRuleResponse> {
  return deleteRequest<DeleteRuleResponse>(`/api/v1/rules/${ruleId}`);
}

export interface ApproveRuleResponse {
  readonly rule: RuleRecord;
}

export function approveRule(ruleId: string): Promise<ApproveRuleResponse> {
  return postJson<ApproveRuleResponse>(`/api/v1/rules/${ruleId}/approve`, {});
}

export interface CreateRuleResponse {
  readonly rule: RuleRecord;
  readonly created: boolean;
}

export function createRule(body: RuleCreateInput): Promise<CreateRuleResponse> {
  return postJson<CreateRuleResponse>("/api/v1/rules", body);
}

export function updateRule(
  ruleId: string,
  body: RuleUpdateInput,
): Promise<RuleRecord> {
  return patchJson<RuleRecord>(`/api/v1/rules/${ruleId}`, body);
}

export function reEvaluateRule(ruleId: string): Promise<unknown> {
  return postJson<unknown>(`/api/v1/rules/${ruleId}/reevaluate`, {});
}
