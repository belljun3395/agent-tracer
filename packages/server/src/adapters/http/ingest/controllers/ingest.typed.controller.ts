import { Controller, Post, Body, HttpStatus, HttpCode, Inject } from "@nestjs/common";
import type { z } from "zod";
import { IngestEventsUseCase } from "~application/events/index.js";
import type { IngestEventInput } from "~application/events/index.js";
import { ClassifyTerminalLaneUseCase } from "~application/rule-commands/index.js";
import {
    toolActivityBatchSchema,
    workflowBatchSchema,
    conversationBatchSchema,
    coordinationBatchSchema,
    lifecycleBatchSchema,
    telemetryBatchSchema,
    type ToolActivityIngestEvent,
    type WorkflowIngestEvent,
    type ConversationIngestEvent,
    type CoordinationIngestEvent,
    type LifecycleIngestEvent,
} from "../schemas/typed.event.ingest.schema.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

type TypedEvent =
    | ToolActivityIngestEvent
    | WorkflowIngestEvent
    | ConversationIngestEvent
    | CoordinationIngestEvent
    | LifecycleIngestEvent;
type ToolActivityBatchBody = z.infer<typeof toolActivityBatchSchema>;
type TelemetryBatchBody = z.infer<typeof telemetryBatchSchema>;
type TypedBatchBody = { readonly events: readonly TypedEvent[] };

@Controller("ingest/v1")
export class TypedIngestController {
    constructor(
        @Inject(IngestEventsUseCase) private readonly ingestEvents: IngestEventsUseCase,
        @Inject(ClassifyTerminalLaneUseCase) private readonly classifyTerminalLane: ClassifyTerminalLaneUseCase,
    ) {}

    @Post("tool-activity")
    @HttpCode(HttpStatus.OK)
    async ingestToolActivity(
        @Body(new ZodValidationPipe(toolActivityBatchSchema, "Invalid request body"))
        body: ToolActivityBatchBody,
    ) {
        const classified = await this.classifyTerminalLane.execute(body.events);
        return this.ingestEvents.execute(classified as readonly IngestEventInput[]);
    }

    @Post("workflow")
    @HttpCode(HttpStatus.OK)
    async ingestWorkflow(
        @Body(new ZodValidationPipe(workflowBatchSchema, "Invalid request body"))
        body: TypedBatchBody,
    ) {
        return this.handleBatch(body);
    }

    @Post("conversation")
    @HttpCode(HttpStatus.OK)
    async ingestConversation(
        @Body(new ZodValidationPipe(conversationBatchSchema, "Invalid request body"))
        body: TypedBatchBody,
    ) {
        return this.handleBatch(body);
    }

    @Post("coordination")
    @HttpCode(HttpStatus.OK)
    async ingestCoordination(
        @Body(new ZodValidationPipe(coordinationBatchSchema, "Invalid request body"))
        body: TypedBatchBody,
    ) {
        return this.handleBatch(body);
    }

    @Post("lifecycle")
    @HttpCode(HttpStatus.OK)
    async ingestLifecycle(
        @Body(new ZodValidationPipe(lifecycleBatchSchema, "Invalid request body"))
        body: TypedBatchBody,
    ) {
        return this.handleBatch(body);
    }

    @Post("telemetry")
    @HttpCode(HttpStatus.OK)
    async ingestTelemetry(
        @Body(new ZodValidationPipe(telemetryBatchSchema, "Invalid request body"))
        body: TelemetryBatchBody,
    ) {
        const events = body.events.map((e): IngestEventInput => ({
            kind: "token.usage",
            taskId: e.taskId,
            lane: "telemetry",
            ...(e.sessionId !== undefined ? { sessionId: e.sessionId } : {}),
            metadata: {
                inputTokens: e.inputTokens,
                outputTokens: e.outputTokens,
                cacheReadTokens: e.cacheReadTokens,
                cacheCreateTokens: e.cacheCreateTokens,
                ...(e.costUsd !== undefined ? { costUsd: e.costUsd } : {}),
                ...(e.durationMs !== undefined ? { durationMs: e.durationMs } : {}),
                ...(e.model !== undefined ? { model: e.model } : {}),
                ...(e.promptId !== undefined ? { promptId: e.promptId } : {}),
            },
        }));
        return this.ingestEvents.execute(events);
    }

    private async handleBatch(body: TypedBatchBody) {
        return this.ingestEvents.execute([...body.events]);
    }
}
