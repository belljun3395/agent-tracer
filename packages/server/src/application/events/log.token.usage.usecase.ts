import { mapTimelineEventToRecord } from "~application/views/index.js";
import type { ITaskRepository, IEventRepository, INotificationPublisher } from "../ports/index.js";
import type { TaskTokenUsageInput } from "./event.write.type.js";
import type { RecordedEventEnvelope } from "../tasks/task.lifecycle.type.js";
import { buildEventRecord } from "./event.recording.ops.js";

export class LogTokenUsageUseCase {
    constructor(
        private readonly taskRepo: ITaskRepository,
        private readonly eventRepo: IEventRepository,
        private readonly notifier: INotificationPublisher,
    ) {}

    async execute(input: TaskTokenUsageInput): Promise<RecordedEventEnvelope> {
        const task = await this.taskRepo.findById(input.taskId);
        if (!task) throw new Error(`Task not found: ${input.taskId}`);

        const record = buildEventRecord({
            taskId: String(input.taskId),
            kind: "token.usage",
            lane: "telemetry",
            title: input.model ? `API call (${input.model})` : "API call",
            body: buildTokenUsageBody(input),
            ...(input.sessionId ? { sessionId: String(input.sessionId) } : {}),
            ...(input.apiCalledAt ? { createdAt: input.apiCalledAt } : {}),
            metadata: {
                inputTokens: input.inputTokens,
                outputTokens: input.outputTokens,
                cacheReadTokens: input.cacheReadTokens,
                cacheCreateTokens: input.cacheCreateTokens,
                ...(input.costUsd != null ? { costUsd: input.costUsd } : {}),
                ...(input.durationMs != null ? { durationMs: input.durationMs } : {}),
                ...(input.model ? { model: input.model } : {}),
                ...(input.promptId ? { promptId: input.promptId } : {}),
                source: "otlp",
            },
        });
        const event = await this.eventRepo.insert({ id: globalThis.crypto.randomUUID(), ...record });
        this.notifier.publish({ type: "event.logged", payload: mapTimelineEventToRecord(event) });

        return {
            task,
            ...(input.sessionId ? { sessionId: input.sessionId } : {}),
            events: [{ id: event.id, kind: event.kind }],
        };
    }
}

function buildTokenUsageBody(input: TaskTokenUsageInput): string {
    const parts: string[] = [];
    if (input.model) parts.push(input.model);
    if (input.durationMs != null) parts.push(`${(input.durationMs / 1000).toFixed(1)}s`);
    const tokenParts: string[] = [];
    if (input.inputTokens) tokenParts.push(`${input.inputTokens.toLocaleString()} in`);
    if (input.outputTokens) tokenParts.push(`${input.outputTokens.toLocaleString()} out`);
    if (input.cacheReadTokens) tokenParts.push(`${input.cacheReadTokens.toLocaleString()} cache read`);
    if (input.cacheCreateTokens) tokenParts.push(`${input.cacheCreateTokens.toLocaleString()} cache write`);
    if (tokenParts.length > 0) parts.push(tokenParts.join(" / "));
    if (input.costUsd != null) parts.push(`$${input.costUsd.toFixed(4)}`);
    return parts.join(" · ");
}
