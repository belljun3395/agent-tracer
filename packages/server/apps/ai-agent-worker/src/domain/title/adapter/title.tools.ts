import { AGENT } from "@monitor/kernel";
import type { EventEntity, EventRepository, TaskRepository } from "@monitor/tracer-domain";
import { type ToolHandlers, withToolTelemetry } from "@monitor/llm-runtime";
import { clampInt } from "~ai-agent-worker/support/clamp.js";
import { toTitleEventPage, type TitleSlimEvent } from "~ai-agent-worker/domain/title/model/title.event.model.js";
import {
    DEFAULT_EVENT_LIMIT,
    DEFAULT_EVENT_ORDER,
    EVENT_ORDER,
    MAX_EVENT_LIMIT,
    MIN_EVENT_LIMIT,
    parseGetTaskEventsArgs,
    TITLE_SUGGESTION_TOOL,
} from "~ai-agent-worker/domain/title/model/title.tool.schema.js";

const AGENT_NAME = AGENT.titleSuggestion.id;

/** title 도구가 쓰는 저장소를 묶는다. */
export interface TitleToolDeps {
    readonly tasks: TaskRepository;
    readonly events: EventRepository;
}

/** 사용자 범위를 고정한 title 슬라이스 소유의 이벤트 조회 도구 핸들러를 만든다. */
export function buildTitleToolHandlers(userId: string, deps: TitleToolDeps): ToolHandlers {
    return {
        [TITLE_SUGGESTION_TOOL.getTaskEvents]: async (raw) => {
            const { taskId, limit, cursor, order } = parseGetTaskEventsArgs(raw);
            return withToolTelemetry(
                {
                    toolName: TITLE_SUGGESTION_TOOL.getTaskEvents,
                    agentName: AGENT_NAME,
                    parameters: { taskId, limit, cursor, order },
                },
                async () => {
                    const task = await deps.tasks.findById(taskId);
                    if (task === null || task.userId !== userId) return `Task ${taskId} not found.`;
                    const size = clampInt(limit, DEFAULT_EVENT_LIMIT, MIN_EVENT_LIMIT, MAX_EVENT_LIMIT);
                    const reading = order ?? DEFAULT_EVENT_ORDER;
                    const [rows, total] = await Promise.all([
                        reading === EVENT_ORDER.desc
                            ? deps.events.findTimelineWindow(taskId, cursor, size + 1)
                            : deps.events.findTimeline(
                                taskId,
                                cursor !== undefined ? { seq: cursor } : undefined,
                                size + 1,
                            ),
                        deps.events.countByTask(taskId),
                    ]);
                    return JSON.stringify(toTitleEventPage(rows.map(toSlimEvent), size, total));
                },
            );
        },
    };
}

function toSlimEvent(event: EventEntity): TitleSlimEvent {
    return {
        id: event.id,
        seq: event.seq,
        kind: event.kind,
        title: event.title,
        ...(event.body !== null ? { body: event.body } : {}),
        ...(event.toolName !== null ? { toolName: event.toolName } : {}),
        filePaths: event.filePaths,
        occurredAt: event.occurredAt.toISOString(),
    };
}
