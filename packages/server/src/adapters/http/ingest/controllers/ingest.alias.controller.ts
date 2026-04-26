import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import { z } from "zod";
import {
    AGENT_ACTIVITY_TYPES,
    ASYNC_TASK_STATUSES,
    EVENT_LANES,
    EVENT_RELATION_TYPES,
    QUESTION_PHASES,
    TODO_STATES,
    type TimelineLane,
} from "~application/events/index.js";
import {
    IngestEventsUseCase,
    type IngestEventsUseCaseEventDto,
    type IngestEventsUseCaseIn,
    type IngestEventsUseCaseOut,
} from "~application/events/index.js";
import { ClassifyTerminalLaneUseCase } from "~application/rule-commands/index.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

const aliasEventSchema = z.object({
    taskId: z.string().min(1),
    sessionId: z.string().min(1).optional(),
    title: z.string().optional(),
    body: z.string().optional(),
    lane: z.enum(EVENT_LANES).optional(),
    filePaths: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
    parentEventId: z.string().min(1).optional(),
    relatedEventIds: z.array(z.string().min(1)).optional(),
    relationType: z.enum(EVENT_RELATION_TYPES).optional(),
    relationLabel: z.string().min(1).optional(),
    relationExplanation: z.string().min(1).optional(),
    createdAt: z.string().optional(),
    taskEffects: z.object({ taskStatus: z.string().optional() }).optional(),
}).passthrough();

const terminalCommandAliasSchema = aliasEventSchema.refine((body) => stringField(body, "command") !== undefined, {
    path: ["command"],
    message: "command is required",
});
const todoAliasSchema = aliasEventSchema
    .refine((body) => stringField(body, "todoId") !== undefined, { path: ["todoId"], message: "todoId is required" })
    .refine((body) => TODO_STATES.includes(stringField(body, "todoState") as (typeof TODO_STATES)[number]), {
        path: ["todoState"],
        message: "todoState is required",
    });
const agentActivityAliasSchema = aliasEventSchema.refine(
    (body) => {
        const activityType = stringField(body, "activityType");
        return activityType === undefined || AGENT_ACTIVITY_TYPES.includes(activityType as (typeof AGENT_ACTIVITY_TYPES)[number]);
    },
    { path: ["activityType"], message: "activityType is invalid" },
);
const asyncTaskAliasSchema = aliasEventSchema
    .refine((body) => stringField(body, "asyncTaskId") !== undefined, {
        path: ["asyncTaskId"],
        message: "asyncTaskId is required",
    })
    .refine((body) => ASYNC_TASK_STATUSES.includes(stringField(body, "asyncStatus") as (typeof ASYNC_TASK_STATUSES)[number]), {
        path: ["asyncStatus"],
        message: "asyncStatus is required",
    });

type AliasEventBody = z.infer<typeof aliasEventSchema>;
type AliasEventKind = IngestEventsUseCaseEventDto["kind"];

const BASE_ALIAS_KEYS = new Set([
    "taskId",
    "sessionId",
    "title",
    "body",
    "lane",
    "filePaths",
    "metadata",
    "parentEventId",
    "relatedEventIds",
    "relationType",
    "relationLabel",
    "relationExplanation",
    "createdAt",
    "taskEffects",
]);

@Controller("api")
export class IngestAliasController {
    constructor(
        @Inject(IngestEventsUseCase) private readonly ingestEvents: IngestEventsUseCase,
        @Inject(ClassifyTerminalLaneUseCase) private readonly classifyTerminalLane: ClassifyTerminalLaneUseCase,
    ) {}

    @Post("user-message")
    @HttpCode(HttpStatus.OK)
    async userMessage(@Body(new ZodValidationPipe(aliasEventSchema)) body: AliasEventBody) {
        return this.ingestAlias(body, "user.message", "user", {
            title: () => stringField(body, "prompt") ?? body.title ?? "User message",
            body: () => body.body ?? stringField(body, "prompt"),
        });
    }

    @Post("save-context")
    @HttpCode(HttpStatus.OK)
    async saveContext(@Body(new ZodValidationPipe(aliasEventSchema)) body: AliasEventBody) {
        return this.ingestAlias(body, "context.saved", "planning", { title: () => body.title ?? "Context saved" });
    }

    @Post("instructions-loaded")
    @HttpCode(HttpStatus.OK)
    async instructionsLoaded(@Body(new ZodValidationPipe(aliasEventSchema)) body: AliasEventBody) {
        const pathHint = stringField(body, "filePath") ?? stringField(body, "file_path");
        return this.ingestAlias(body, "instructions.loaded", "planning", {
            title: () => body.title ?? (pathHint ? `Instructions loaded: ${pathHint}` : "Instructions loaded"),
        });
    }

    @Post("plan")
    @HttpCode(HttpStatus.OK)
    async plan(@Body(new ZodValidationPipe(aliasEventSchema)) body: AliasEventBody) {
        return this.ingestAlias(body, "plan.logged", "planning", {
            title: () => body.title ?? stringField(body, "action") ?? "Plan",
        });
    }

    @Post("action")
    @HttpCode(HttpStatus.OK)
    async action(@Body(new ZodValidationPipe(aliasEventSchema)) body: AliasEventBody) {
        return this.ingestAlias(body, "action.logged", "implementation", {
            title: () => body.title ?? stringField(body, "action") ?? "Action",
        });
    }

    @Post("verify")
    @HttpCode(HttpStatus.OK)
    async verify(@Body(new ZodValidationPipe(aliasEventSchema)) body: AliasEventBody) {
        return this.ingestAlias(body, "verification.logged", "implementation", {
            title: () => body.title ?? stringField(body, "action") ?? "Verification",
            body: () => body.body ?? stringField(body, "result"),
            metadata: () => ({
                ...(stringField(body, "status") ? { verificationStatus: stringField(body, "status") } : {}),
            }),
        });
    }

    @Post("rule")
    @HttpCode(HttpStatus.OK)
    async rule(@Body(new ZodValidationPipe(aliasEventSchema)) body: AliasEventBody) {
        return this.ingestAlias(body, "rule.logged", "rule", {
            title: () => body.title ?? stringField(body, "ruleId") ?? stringField(body, "action") ?? "Rule event",
            metadata: () => ({
                ...(stringField(body, "status") ? { ruleStatus: stringField(body, "status") } : {}),
                ...(stringField(body, "source") ? { ruleSource: stringField(body, "source") } : {}),
                ...(stringField(body, "severity") ? { severity: stringField(body, "severity") } : {}),
            }),
        });
    }

    @Post("question")
    @HttpCode(HttpStatus.OK)
    async question(@Body(new ZodValidationPipe(aliasEventSchema)) body: AliasEventBody) {
        const phase = normalizeQuestionPhase(stringField(body, "questionPhase"));
        const questionId = stringField(body, "questionId") ?? `q-${globalThis.crypto.randomUUID()}`;
        return this.ingestAlias(body, "question.logged", phase === "concluded" ? "planning" : "questions", {
            title: () => body.title ?? "Question",
            metadata: () => ({ questionId, questionPhase: phase }),
        });
    }

    @Post("thought")
    @HttpCode(HttpStatus.OK)
    async thought(@Body(new ZodValidationPipe(aliasEventSchema)) body: AliasEventBody) {
        return this.ingestAlias(body, "thought.logged", "planning", { title: () => body.title ?? "Thought" });
    }

    @Post("tool-used")
    @HttpCode(HttpStatus.OK)
    async toolUsed(@Body(new ZodValidationPipe(aliasEventSchema)) body: AliasEventBody) {
        return this.ingestAlias(body, "tool.used", "implementation", {
            title: () => body.title ?? (stringField(body, "toolName") ? `Tool: ${stringField(body, "toolName")}` : "Tool used"),
        });
    }

    @Post("explore")
    @HttpCode(HttpStatus.OK)
    async explore(@Body(new ZodValidationPipe(aliasEventSchema)) body: AliasEventBody) {
        return this.ingestAlias(body, "tool.used", "exploration", {
            title: () => body.title ?? (stringField(body, "toolName") ? `Explore: ${stringField(body, "toolName")}` : "Explore"),
        });
    }

    @Post("terminal-command")
    @HttpCode(HttpStatus.OK)
    async terminalCommand(@Body(new ZodValidationPipe(terminalCommandAliasSchema)) body: AliasEventBody) {
        const command = stringField(body, "command") ?? "";
        const event = buildAliasEvent(body, "terminal.command", body.lane ?? "implementation", {
            title: command ? `Command: ${command.slice(0, 80)}` : "Terminal command",
            body: body.body ?? command,
        });
        const classified = await this.classifyTerminalLane.execute([event]);
        const input = { events: classified } satisfies IngestEventsUseCaseIn;
        return this.ingestEvents.execute(input);
    }

    @Post("todo")
    @HttpCode(HttpStatus.OK)
    async todo(@Body(new ZodValidationPipe(todoAliasSchema)) body: AliasEventBody) {
        return this.ingestAlias(body, "todo.logged", "todos", {
            title: () => body.title ?? stringField(body, "body") ?? stringField(body, "todoId") ?? "Todo",
        });
    }

    @Post("agent-activity")
    @HttpCode(HttpStatus.OK)
    async agentActivity(@Body(new ZodValidationPipe(agentActivityAliasSchema)) body: AliasEventBody) {
        return this.ingestAlias(body, "agent.activity.logged", "coordination", {
            title: () => body.title ?? stringField(body, "activityType") ?? "Agent activity",
        });
    }

    @Post("async-task")
    @HttpCode(HttpStatus.OK)
    async asyncTask(@Body(new ZodValidationPipe(asyncTaskAliasSchema)) body: AliasEventBody) {
        return this.ingestAlias(body, "action.logged", "background", {
            title: () => body.title ?? `Async task: ${stringField(body, "asyncStatus") ?? "update"}`,
            body: () => body.body ?? stringField(body, "description"),
            metadata: () => ({
                ...(stringField(body, "agent") ? { asyncAgent: stringField(body, "agent") } : {}),
                ...(stringField(body, "category") ? { asyncCategory: stringField(body, "category") } : {}),
                ...(numberField(body, "durationMs") !== undefined ? { asyncDurationMs: numberField(body, "durationMs") } : {}),
            }),
        });
    }

    private async ingestAlias(
        body: AliasEventBody,
        kind: AliasEventKind,
        defaultLane: TimelineLane,
        options: AliasBuildOptions = {},
    ): Promise<IngestEventsUseCaseOut> {
        const input = {
            events: [buildAliasEvent(body, kind, body.lane ?? defaultLane, {
                title: options.title?.(),
                body: options.body?.(),
                metadata: options.metadata?.(),
            })],
        } satisfies IngestEventsUseCaseIn;
        return this.ingestEvents.execute(input);
    }
}

interface AliasBuildOptions {
    readonly title?: () => string | undefined;
    readonly body?: () => string | undefined;
    readonly metadata?: () => Record<string, unknown>;
}

interface AliasBuildValues {
    readonly title?: string | undefined;
    readonly body?: string | undefined;
    readonly metadata?: Record<string, unknown> | undefined;
}

function buildAliasEvent(
    body: AliasEventBody,
    kind: AliasEventKind,
    lane: TimelineLane,
    values: AliasBuildValues = {},
): IngestEventsUseCaseEventDto {
    const metadata = collectMetadata(body, values.metadata);
    return {
        kind,
        taskId: body.taskId,
        lane,
        title: values.title ?? body.title ?? kind,
        metadata,
        ...(body.sessionId ? { sessionId: body.sessionId } : {}),
        ...(values.body ?? body.body ? { body: values.body ?? body.body } : {}),
        ...(body.filePaths ? { filePaths: body.filePaths } : {}),
        ...(body.parentEventId ? { parentEventId: body.parentEventId } : {}),
        ...(body.relatedEventIds ? { relatedEventIds: body.relatedEventIds } : {}),
        ...(body.relationType ? { relationType: body.relationType } : {}),
        ...(body.relationLabel ? { relationLabel: body.relationLabel } : {}),
        ...(body.relationExplanation ? { relationExplanation: body.relationExplanation } : {}),
        ...(body.createdAt ? { createdAt: body.createdAt } : {}),
        ...(body.taskEffects ? { taskEffects: body.taskEffects } : {}),
    } as IngestEventsUseCaseEventDto;
}

function collectMetadata(body: AliasEventBody, overrides: Record<string, unknown> | undefined): Record<string, unknown> {
    const record = body as Record<string, unknown>;
    const extras: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
        if (BASE_ALIAS_KEYS.has(key) || value === undefined) continue;
        extras[key] = value;
    }
    return {
        ...(body.metadata ?? {}),
        ...extras,
        ...(overrides ?? {}),
    };
}

function stringField(value: unknown, key: string): string | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const raw = (value as Record<string, unknown>)[key];
    return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined;
}

function numberField(value: unknown, key: string): number | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const raw = (value as Record<string, unknown>)[key];
    return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

function normalizeQuestionPhase(value: string | undefined): (typeof QUESTION_PHASES)[number] {
    if (QUESTION_PHASES.includes(value as (typeof QUESTION_PHASES)[number])) {
        return value as (typeof QUESTION_PHASES)[number];
    }
    return "asked";
}
