/**
 * @module nestjs/controllers/event.controller
 *
 * Event logging endpoints.
 */
import {
  Controller, Post, Patch,
  Body, Param, HttpException, HttpStatus, HttpCode
} from "@nestjs/common";
import { MonitorServiceProvider } from "../service/monitor-service.provider.js";
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
  TaskAssistantResponseInput,
  EventPatchInput
} from "../../application/types.js";
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
  assistantResponseSchema,
  eventPatchSchema
} from "../../presentation/schemas.js";

@Controller()
export class EventController {
  constructor(private readonly service: MonitorServiceProvider) {}

  @Post("/api/tool-used")
  @HttpCode(HttpStatus.OK)
  async toolUsed(@Body() body: unknown) {
    return this.service.logToolUsed(toolUsedSchema.parse(body) as TaskToolUsedInput);
  }

  @Post("/api/terminal-command")
  @HttpCode(HttpStatus.OK)
  async terminalCommand(@Body() body: unknown) {
    return this.service.logTerminalCommand(terminalCommandSchema.parse(body) as TaskTerminalCommandInput);
  }

  @Post("/api/save-context")
  @HttpCode(HttpStatus.OK)
  async saveContext(@Body() body: unknown) {
    return this.service.saveContext(contextSavedSchema.parse(body) as TaskContextSavedInput);
  }

  @Post("/api/explore")
  @HttpCode(HttpStatus.OK)
  async explore(@Body() body: unknown) {
    return this.service.logExploration(exploreSchema.parse(body) as TaskExploreInput);
  }

  @Post("/api/plan")
  @HttpCode(HttpStatus.OK)
  async plan(@Body() body: unknown) {
    return this.service.logPlan(actionEventSchema.parse(body) as TaskPlanInput);
  }

  @Post("/api/action")
  @HttpCode(HttpStatus.OK)
  async action(@Body() body: unknown) {
    return this.service.logAction(actionEventSchema.parse(body) as TaskActionInput);
  }

  @Post("/api/verify")
  @HttpCode(HttpStatus.OK)
  async verify(@Body() body: unknown) {
    return this.service.logVerification(verifySchema.parse(body) as TaskVerifyInput);
  }

  @Post("/api/rule")
  @HttpCode(HttpStatus.OK)
  async rule(@Body() body: unknown) {
    return this.service.logRule(ruleSchema.parse(body) as TaskRuleInput);
  }

  @Post("/api/async-task")
  @HttpCode(HttpStatus.OK)
  async asyncTask(@Body() body: unknown) {
    return this.service.logAsyncLifecycle(asyncLifecycleSchema.parse(body) as TaskAsyncLifecycleInput);
  }

  @Post("/api/agent-activity")
  @HttpCode(HttpStatus.OK)
  async agentActivity(@Body() body: unknown) {
    return this.service.logAgentActivity(agentActivitySchema.parse(body) as TaskAgentActivityInput);
  }

  @Post("/api/user-message")
  @HttpCode(HttpStatus.OK)
  async userMessage(@Body() body: unknown) {
    return this.service.logUserMessage(userMessageSchema.parse(body) as TaskUserMessageInput);
  }

  @Post("/api/question")
  @HttpCode(HttpStatus.OK)
  async question(@Body() body: unknown) {
    return this.service.logQuestion(questionSchema.parse(body) as TaskQuestionInput);
  }

  @Post("/api/todo")
  @HttpCode(HttpStatus.OK)
  async todo(@Body() body: unknown) {
    return this.service.logTodo(todoSchema.parse(body) as TaskTodoInput);
  }

  @Post("/api/thought")
  @HttpCode(HttpStatus.OK)
  async thought(@Body() body: unknown) {
    return this.service.logThought(thoughtSchema.parse(body) as TaskThoughtInput);
  }

  @Post("/api/assistant-response")
  @HttpCode(HttpStatus.OK)
  async assistantResponse(@Body() body: unknown) {
    return this.service.logAssistantResponse(assistantResponseSchema.parse(body) as TaskAssistantResponseInput);
  }

  @Patch("/api/events/:eventId")
  async patchEvent(@Param("eventId") eventId: string, @Body() body: unknown) {
    const parsed = eventPatchSchema.parse(body) as { displayTitle?: string | null };
    const event = await this.service.updateEvent({
      eventId,
      ...(parsed.displayTitle !== undefined ? { displayTitle: parsed.displayTitle } : {})
    } satisfies EventPatchInput);
    if (!event) {
      throw new HttpException({ error: "Event not found" }, HttpStatus.NOT_FOUND);
    }
    return { event };
  }
}
