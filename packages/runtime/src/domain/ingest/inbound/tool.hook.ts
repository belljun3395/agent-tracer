import type {AppendEventsUsecase} from "~runtime/domain/ingest/application/append.events.usecase.js";
import type {MarkToolStartUsecase} from "~runtime/domain/ingest/application/mark.tool.start.usecase.js";
import type {RecordTodoUsecase} from "~runtime/domain/ingest/application/record.todo.usecase.js";
import type {RecordToolFailureUsecase} from "~runtime/domain/ingest/application/record.tool.failure.usecase.js";
import type {RecordToolUseUsecase} from "~runtime/domain/ingest/application/record.tool.use.usecase.js";
import type {IngestTarget, RuntimeIngestEvent} from "~runtime/domain/ingest/model/event.model.js";
import type {RunEventInput} from "~runtime/domain/ingest/model/ingest.event.model.js";
import type {ShapedToolEvent, ToolCall, ToolFailure} from "~runtime/domain/ingest/model/tool.call.model.js";

/** 수집 도메인이 어댑터에 제공하는 진입점 묶음이다. */
export interface IngestHook {
    readonly appendEvents: AppendEventsUsecase;
    readonly recordToolUse: RecordToolUseUsecase;
    readonly recordToolFailure: RecordToolFailureUsecase;
    readonly recordTodo: RecordTodoUsecase;
    readonly markToolStart: MarkToolStartUsecase;
}

export function onToolUse(
    hook: IngestHook,
    call: ToolCall,
    target: IngestTarget,
): Promise<ShapedToolEvent | null> {
    return hook.recordToolUse.execute(call, target);
}

export function onToolFailure(hook: IngestHook, failure: ToolFailure, target: IngestTarget): Promise<void> {
    return hook.recordToolFailure.execute(failure, target);
}

export function onTodoTool(
    hook: IngestHook,
    call: ToolCall,
    target: IngestTarget,
    runtimeSessionId: string,
): Promise<void> {
    return hook.recordTodo.execute(call, target, runtimeSessionId);
}

export function onToolStart(hook: IngestHook, sessionId: string, toolUseId: string): void {
    hook.markToolStart.execute(sessionId, toolUseId);
}

export function onLifecycleEvent(
    hook: IngestHook,
    events: readonly (RuntimeIngestEvent | RunEventInput)[],
): Promise<void> {
    return hook.appendEvents.execute(events);
}
