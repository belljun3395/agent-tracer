/**
 * @module application/services/trace-metadata-factory
 *
 * 이벤트 메타데이터 빌드·태그 도출·표준화 유틸리티.
 */

import { tokenizeActionName, type AgentActivityType } from "@monitor/core";

import type { GenericEventInput, TraceActivityInput, TraceRelationInput } from "../types.js";
import {
  extractMetadataBoolean,
  extractMetadataString,
  extractMetadataStringArray,
  normalizeTagSegment
} from "./trace-metadata-factory.helpers.js";

export class TraceMetadataFactory {
  static build(
    metadata: Record<string, unknown> | undefined,
    input: { readonly metadata?: Record<string, unknown> } & Partial<TraceActivityInput & TraceRelationInput>
  ): Record<string, unknown> {
    return {
      ...(metadata ?? {}),
      ...(input.parentEventId ? { parentEventId: input.parentEventId } : {}),
      ...(input.relatedEventIds && input.relatedEventIds.length > 0
        ? { relatedEventIds: [...input.relatedEventIds] }
        : {}),
      ...(input.workItemId ? { workItemId: input.workItemId } : {}),
      ...(input.goalId ? { goalId: input.goalId } : {}),
      ...(input.planId ? { planId: input.planId } : {}),
      ...(input.handoffId ? { handoffId: input.handoffId } : {}),
      ...(input.relationType ? { relationType: input.relationType } : {}),
      ...(input.relationLabel ? { relationLabel: input.relationLabel } : {}),
      ...(input.relationExplanation ? { relationExplanation: input.relationExplanation } : {}),
      ...(input.activityType ? { activityType: input.activityType } : {}),
      ...(input.agentName ? { agentName: input.agentName } : {}),
      ...(input.skillName ? { skillName: input.skillName } : {}),
      ...(input.skillPath ? { skillPath: input.skillPath } : {}),
      ...(input.mcpServer ? { mcpServer: input.mcpServer } : {}),
      ...(input.mcpTool ? { mcpTool: input.mcpTool } : {})
    };
  }

  static deriveTags(input: GenericEventInput): readonly string[] {
    const tags = new Set<string>();
    const metadata = input.metadata ?? {};

    if (input.actionName) {
      const rootAction = tokenizeActionName(input.actionName)[0];
      if (rootAction) {
        tags.add(`action:${normalizeTagSegment(rootAction)}`);
      }
    }

    if (input.kind === "verification.logged") {
      tags.add("verification");
    }

    if (input.kind === "rule.logged") {
      tags.add("rule-event");
    }

    const ruleId = extractMetadataString(metadata, "ruleId");
    if (ruleId) {
      tags.add(`rule:${normalizeTagSegment(ruleId)}`);
    }

    const ruleStatus = extractMetadataString(metadata, "ruleStatus");
    if (ruleStatus) {
      tags.add(`status:${normalizeTagSegment(ruleStatus)}`);
    }

    const verificationStatus = extractMetadataString(metadata, "verificationStatus");
    if (verificationStatus) {
      tags.add(`status:${normalizeTagSegment(verificationStatus)}`);
    }

    const severity = extractMetadataString(metadata, "severity");
    if (severity) {
      tags.add(`severity:${normalizeTagSegment(severity)}`);
    }

    const asyncTaskId = extractMetadataString(metadata, "asyncTaskId");
    if (asyncTaskId) {
      tags.add("async-task");
    }

    const asyncStatus = extractMetadataString(metadata, "asyncStatus");
    if (asyncStatus) {
      tags.add(`async:${normalizeTagSegment(asyncStatus)}`);
      tags.add(`status:${normalizeTagSegment(asyncStatus)}`);
    }

    const asyncAgent = extractMetadataString(metadata, "asyncAgent");
    if (asyncAgent) {
      tags.add(`agent:${normalizeTagSegment(asyncAgent)}`);
    }

    const asyncCategory = extractMetadataString(metadata, "asyncCategory");
    if (asyncCategory) {
      tags.add(`category:${normalizeTagSegment(asyncCategory)}`);
    }

    const activityType = extractMetadataString(metadata, "activityType");
    if (activityType) {
      tags.add("coordination");
      tags.add(`activity:${normalizeTagSegment(activityType)}`);
    }

    const subtypeKey = extractMetadataString(metadata, "subtypeKey");
    if (subtypeKey) {
      tags.add(`subtype:${normalizeTagSegment(subtypeKey)}`);
    }

    const subtypeGroup = extractMetadataString(metadata, "subtypeGroup");
    if (subtypeGroup) {
      tags.add(`subtype-group:${normalizeTagSegment(subtypeGroup)}`);
    }

    const entityType = extractMetadataString(metadata, "entityType");
    if (entityType) {
      tags.add(`entity:${normalizeTagSegment(entityType)}`);
    }

    const toolFamily = extractMetadataString(metadata, "toolFamily");
    if (toolFamily) {
      tags.add(`tool-family:${normalizeTagSegment(toolFamily)}`);
    }

    const operation = extractMetadataString(metadata, "operation");
    if (operation) {
      tags.add(`operation:${normalizeTagSegment(operation)}`);
    }

    const sourceTool = extractMetadataString(metadata, "sourceTool");
    if (sourceTool) {
      tags.add(`source-tool:${normalizeTagSegment(sourceTool)}`);
    }

    const importance = extractMetadataString(metadata, "importance");
    if (importance) {
      tags.add(`importance:${normalizeTagSegment(importance)}`);
    }

    const agentName = extractMetadataString(metadata, "agentName");
    if (agentName) {
      tags.add(`agent:${normalizeTagSegment(agentName)}`);
    }

    const skillName = extractMetadataString(metadata, "skillName");
    if (skillName) {
      tags.add(`skill:${normalizeTagSegment(skillName)}`);
    }

    const ruleSource = extractMetadataString(metadata, "ruleSource");
    if (ruleSource) {
      tags.add(`source:${normalizeTagSegment(ruleSource)}`);
    }

    const questionId = extractMetadataString(metadata, "questionId");
    if (questionId) tags.add("question");

    const questionPhase = extractMetadataString(metadata, "questionPhase");
    if (questionPhase) tags.add(`question:${normalizeTagSegment(questionPhase)}`);

    const todoId = extractMetadataString(metadata, "todoId");
    if (todoId) tags.add("todo");

    const todoState = extractMetadataString(metadata, "todoState");
    if (todoState) tags.add(`todo:${normalizeTagSegment(todoState)}`);

    const modelName = extractMetadataString(metadata, "modelName");
    if (modelName) tags.add(`model:${normalizeTagSegment(modelName)}`);

    const modelProvider = extractMetadataString(metadata, "modelProvider");
    if (modelProvider) tags.add(`provider:${normalizeTagSegment(modelProvider)}`);

    const mcpServer = extractMetadataString(metadata, "mcpServer");
    if (mcpServer) tags.add(`mcp:${normalizeTagSegment(mcpServer)}`);

    const mcpTool = extractMetadataString(metadata, "mcpTool");
    if (mcpTool) tags.add(`mcp-tool:${normalizeTagSegment(mcpTool)}`);

    const workItemId = extractMetadataString(metadata, "workItemId");
    if (workItemId) tags.add(`work-item:${normalizeTagSegment(workItemId)}`);

    const goalId = extractMetadataString(metadata, "goalId");
    if (goalId) tags.add(`goal:${normalizeTagSegment(goalId)}`);

    const planId = extractMetadataString(metadata, "planId");
    if (planId) tags.add(`plan:${normalizeTagSegment(planId)}`);

    const relationType = extractMetadataString(metadata, "relationType");
    if (relationType) tags.add(`relation:${normalizeTagSegment(relationType)}`);

    if (extractMetadataBoolean(metadata, "compactEvent")) {
      tags.add("compact");
    }

    const compactPhase = extractMetadataString(metadata, "compactPhase");
    if (compactPhase) {
      tags.add(`compact:${normalizeTagSegment(compactPhase)}`);
    }

    const compactEventType = extractMetadataString(metadata, "compactEventType");
    if (compactEventType) {
      tags.add(`compact:${normalizeTagSegment(compactEventType)}`);
    }

    for (const compactSignal of extractMetadataStringArray(metadata, "compactSignals")) {
      tags.add(`compact:${normalizeTagSegment(compactSignal)}`);
    }

    return [...tags];
  }

  static normalizeVerificationStatus(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();

    if (normalized.includes("pass") || normalized.includes("ok") || normalized.includes("success")) {
      return "pass";
    }

    if (normalized.includes("fail") || normalized.includes("error")) {
      return "fail";
    }

    if (normalized.includes("warn")) {
      return "warn";
    }

    return normalized;
  }

  static normalizeAgentActivityTitle(activityType: AgentActivityType): string {
    switch (activityType) {
      case "agent_step":
        return "Agent step";
      case "mcp_call":
        return "MCP call";
      case "skill_use":
        return "Skill use";
      case "delegation":
        return "Delegation";
      case "handoff":
        return "Handoff";
      case "bookmark":
        return "Bookmark";
      case "search":
        return "Search";
    }
  }
}
