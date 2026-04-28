import type { AnyDomainEventDraft } from "~domain/events/model/domain.events.model.js";

interface EventInsertInput {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId?: string | null;
    readonly kind: string;
    readonly lane: string;
    readonly title: string;
    readonly metadata: Record<string, unknown>;
    readonly createdAt: string;
}

export function mapTimelineInsertToDomainEvent(input: EventInsertInput): AnyDomainEventDraft | null {
    const base = {
        eventTime: Date.parse(input.createdAt),
        aggregateId: input.taskId,
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        actor: actorFromLane(input.lane),
        schemaVer: 1,
    } as const;

    if (!Number.isFinite(base.eventTime)) return null;

    if (input.kind === "tool.used" || input.kind === "terminal.command") {
        return {
            ...base,
            eventType: "tool.invoked",
            payload: {
                session_id: input.sessionId ?? input.taskId,
                tool_name: toolNameFromEvent(input),
                args_hash: input.metadata["argsHash"],
                args_ref: input.metadata["argsRef"],
                event_id_ref: input.id,
            },
        };
    }

    if (input.kind === "user.message") {
        return {
            ...base,
            eventType: "prompt.submitted",
            payload: {
                session_id: input.sessionId ?? input.taskId,
                prompt_ref: input.metadata["promptRef"],
                event_id_ref: input.id,
            },
        };
    }

    if (input.kind === "assistant.response") {
        return {
            ...base,
            eventType: "completion.received",
            payload: {
                session_id: input.sessionId ?? input.taskId,
                completion_ref: input.metadata["completionRef"],
                event_id_ref: input.id,
            },
        };
    }

    return null;
}

function actorFromLane(lane: string): "user" | "claude" | "codex" | "system" {
    if (lane === "user") return "user";
    const source = String(lane).toLowerCase();
    if (source.includes("claude")) return "claude";
    if (source.includes("codex")) return "codex";
    return "system";
}

function toolNameFromEvent(input: EventInsertInput): string {
    const metadataTool = input.metadata["toolName"] ?? input.metadata["tool_name"];
    if (typeof metadataTool === "string" && metadataTool.trim()) return metadataTool;
    return input.title.trim() || input.kind;
}
