import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import type { z } from "zod";
import { IngestEventsUseCase } from "~application/events/index.js";
import type { IngestEventsUseCaseEventDto, IngestEventsUseCaseIn } from "~application/events/index.js";
import { ClassifyTerminalLaneUseCase } from "~application/rule-commands/index.js";
import {
    conversationBatchSchema,
    coordinationBatchSchema,
    lifecycleBatchSchema,
    telemetryBatchSchema,
    toolActivityBatchSchema,
    workflowBatchSchema,
    type ConversationIngestEvent,
    type CoordinationIngestEvent,
    type LifecycleIngestEvent,
    type ToolActivityIngestEvent,
    type WorkflowIngestEvent,
} from "~adapters/http/ingest/schemas/typed.event.ingest.schema.js";
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
export class TypedEventIngestController {
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
        const input = { events: classified as readonly IngestEventsUseCaseEventDto[] } satisfies IngestEventsUseCaseIn;
        return this.ingestEvents.execute(input);
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
        const events = body.events.map((event): IngestEventsUseCaseEventDto => ({
            kind: "token.usage",
            taskId: event.taskId,
            lane: "telemetry",
            ...(event.sessionId !== undefined ? { sessionId: event.sessionId } : {}),
            metadata: {
                inputTokens: event.inputTokens,
                outputTokens: event.outputTokens,
                cacheReadTokens: event.cacheReadTokens,
                cacheCreateTokens: event.cacheCreateTokens,
                ...(event.costUsd !== undefined ? { costUsd: event.costUsd } : {}),
                ...(event.durationMs !== undefined ? { durationMs: event.durationMs } : {}),
                ...(event.model !== undefined ? { model: event.model } : {}),
                ...(event.promptId !== undefined ? { promptId: event.promptId } : {}),
            },
        }));
        return this.ingestEvents.execute({ events });
    }

    private async handleBatch(body: TypedBatchBody) {
        const input = { events: [...body.events] } satisfies IngestEventsUseCaseIn;
        return this.ingestEvents.execute(input);
    }
}
