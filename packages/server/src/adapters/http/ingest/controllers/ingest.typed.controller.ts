import { Controller, Post, Body, HttpException, HttpStatus, HttpCode, Inject } from "@nestjs/common";
import { IngestEventsUseCase } from "~application/events/index.js";
import type { IngestEventInput } from "~application/events/index.js";
import { GetRulePatternsUseCase } from "~application/rule-commands/index.js";
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
import type { ZodSchema } from "zod";

type TypedEvent =
    | ToolActivityIngestEvent
    | WorkflowIngestEvent
    | ConversationIngestEvent
    | CoordinationIngestEvent
    | LifecycleIngestEvent;

@Controller("ingest/v1")
export class TypedIngestController {
    constructor(
        @Inject(IngestEventsUseCase) private readonly ingestEvents: IngestEventsUseCase,
        @Inject(GetRulePatternsUseCase) private readonly getRulePatterns: GetRulePatternsUseCase,
    ) {}

    @Post("tool-activity")
    @HttpCode(HttpStatus.OK)
    async ingestToolActivity(@Body() body: unknown) {
        const parsed = toolActivityBatchSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException(
                {
                    ok: false,
                    error: {
                        code: "validation_error",
                        message: "Invalid request body",
                        details: parsed.error.format(),
                    },
                },
                HttpStatus.BAD_REQUEST,
            );
        }
        const terminalEvents = parsed.data.events.filter((e) => e.kind === "terminal.command");
        const uniqueTaskIds = [...new Set(terminalEvents.map((e) => e.taskId))];
        const patternsByTask = new Map(
            await Promise.all(
                uniqueTaskIds.map(async (taskId) => [taskId, await this.getRulePatterns.execute(taskId)] as const),
            ),
        );

        const events = parsed.data.events.map((event) => {
            if (event.kind !== "terminal.command") return event;
            const command = event.metadata?.["command"];
            if (typeof command !== "string") return event;
            const patterns = patternsByTask.get(event.taskId) ?? [];
            const matches = patterns.some((p) => command.toLowerCase().includes(p.trim().toLowerCase()));
            return matches ? { ...event, lane: "rule" as const } : event;
        });
        const result = await this.ingestEvents.execute(events);
        return { ok: true, data: result };
    }

    @Post("workflow")
    @HttpCode(HttpStatus.OK)
    async ingestWorkflow(@Body() body: unknown) {
        return this.handleBatch(body, workflowBatchSchema);
    }

    @Post("conversation")
    @HttpCode(HttpStatus.OK)
    async ingestConversation(@Body() body: unknown) {
        return this.handleBatch(body, conversationBatchSchema);
    }

    @Post("coordination")
    @HttpCode(HttpStatus.OK)
    async ingestCoordination(@Body() body: unknown) {
        return this.handleBatch(body, coordinationBatchSchema);
    }

    @Post("lifecycle")
    @HttpCode(HttpStatus.OK)
    async ingestLifecycle(@Body() body: unknown) {
        return this.handleBatch(body, lifecycleBatchSchema);
    }

    @Post("telemetry")
    @HttpCode(HttpStatus.OK)
    async ingestTelemetry(@Body() body: unknown) {
        const parsed = telemetryBatchSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException(
                {
                    ok: false,
                    error: {
                        code: "validation_error",
                        message: "Invalid request body",
                        details: parsed.error.format(),
                    },
                },
                HttpStatus.BAD_REQUEST,
            );
        }
        const events = parsed.data.events.map((e): IngestEventInput => ({
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
        const result = await this.ingestEvents.execute(events);
        return { ok: true, data: result };
    }

    private async handleBatch(
        body: unknown,
        schema: ZodSchema<{ events: TypedEvent[] }>,
    ) {
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException(
                {
                    ok: false,
                    error: {
                        code: "validation_error",
                        message: "Invalid request body",
                        details: parsed.error.format(),
                    },
                },
                HttpStatus.BAD_REQUEST,
            );
        }
        const result = await this.ingestEvents.execute(parsed.data.events);
        return { ok: true, data: result };
    }
}
