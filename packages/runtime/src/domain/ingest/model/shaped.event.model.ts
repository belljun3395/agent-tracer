import {turnOf, type IngestTarget, type RuntimeIngestEvent} from "~runtime/domain/ingest/model/event.model.js";
import type {ShapedToolEvent} from "~runtime/domain/ingest/model/tool.call.model.js";

/** 조형된 도구 이벤트를 태스크와 세션과 턴에 붙여 원장 이벤트로 만든다. */
export function toRuntimeEvent(shaped: ShapedToolEvent, target: IngestTarget): RuntimeIngestEvent {
    return {
        kind: shaped.kind,
        taskId: target.taskId,
        sessionId: target.sessionId,
        ...turnOf(target),
        lane: shaped.lane,
        title: shaped.title,
        ...(shaped.body !== undefined ? {body: shaped.body} : {}),
        ...(shaped.filePaths !== undefined ? {filePaths: shaped.filePaths} : {}),
        ...(shaped.toolName !== undefined ? {toolName: shaped.toolName} : {}),
        ...(shaped.command !== undefined ? {command: shaped.command} : {}),
        metadata: shaped.metadata,
    };
}
