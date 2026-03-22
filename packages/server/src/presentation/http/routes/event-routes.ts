/**
 * @module presentation/http/routes/event-routes
 *
 * Event logging endpoints.
 */
import { Router } from "express";
import type { MonitorService } from "../../../application/monitor-service.js";
import type {
  TaskToolUsedInput,
  TaskTerminalCommandInput,
  TaskContextSavedInput,
  TaskExploreInput,
  TaskPlanInput,
  TaskActionInput,
  TaskVerifyInput,
  TaskRuleInput,
  TaskAsyncLifecycleInput,
  TaskAgentActivityInput,
  TaskUserMessageInput,
  TaskQuestionInput,
  TaskTodoInput,
  TaskThoughtInput,
  TaskAssistantResponseInput
} from "../../../application/types.js";
import {
  toolUsedSchema,
  terminalCommandSchema,
  contextSavedSchema,
  exploreSchema,
  actionEventSchema,
  verifySchema,
  ruleSchema,
  asyncLifecycleSchema,
  agentActivitySchema,
  userMessageSchema,
  questionSchema,
  todoSchema,
  thoughtSchema,
  assistantResponseSchema
} from "../../schemas.js";

export function createEventRoutes(service: MonitorService): Router {
  const router = Router();

  router.post("/api/tool-used", async (req, res) => {
    res.json(await service.logToolUsed(toolUsedSchema.parse(req.body) as TaskToolUsedInput));
  });

  router.post("/api/terminal-command", async (req, res) => {
    res.json(await service.logTerminalCommand(terminalCommandSchema.parse(req.body) as TaskTerminalCommandInput));
  });

  router.post("/api/save-context", async (req, res) => {
    res.json(await service.saveContext(contextSavedSchema.parse(req.body) as TaskContextSavedInput));
  });

  router.post("/api/explore", async (req, res) => {
    res.json(await service.logExploration(exploreSchema.parse(req.body) as TaskExploreInput));
  });

  router.post("/api/plan", async (req, res) => {
    res.json(await service.logPlan(actionEventSchema.parse(req.body) as TaskPlanInput));
  });

  router.post("/api/action", async (req, res) => {
    res.json(await service.logAction(actionEventSchema.parse(req.body) as TaskActionInput));
  });

  router.post("/api/verify", async (req, res) => {
    res.json(await service.logVerification(verifySchema.parse(req.body) as TaskVerifyInput));
  });

  router.post("/api/rule", async (req, res) => {
    res.json(await service.logRule(ruleSchema.parse(req.body) as TaskRuleInput));
  });

  router.post("/api/async-task", async (req, res) => {
    res.json(await service.logAsyncLifecycle(asyncLifecycleSchema.parse(req.body) as TaskAsyncLifecycleInput));
  });

  router.post("/api/agent-activity", async (req, res) => {
    res.json(await service.logAgentActivity(agentActivitySchema.parse(req.body) as TaskAgentActivityInput));
  });

  router.post("/api/user-message", async (req, res) => {
    res.json(await service.logUserMessage(userMessageSchema.parse(req.body) as TaskUserMessageInput));
  });

  router.post("/api/question", async (req, res) => {
    res.json(await service.logQuestion(questionSchema.parse(req.body) as TaskQuestionInput));
  });

  router.post("/api/todo", async (req, res) => {
    res.json(await service.logTodo(todoSchema.parse(req.body) as TaskTodoInput));
  });

  router.post("/api/thought", async (req, res) => {
    res.json(await service.logThought(thoughtSchema.parse(req.body) as TaskThoughtInput));
  });

  router.post("/api/assistant-response", async (req, res) => {
    res.json(
      await service.logAssistantResponse(
        assistantResponseSchema.parse(req.body) as TaskAssistantResponseInput
      )
    );
  });

  return router;
}
