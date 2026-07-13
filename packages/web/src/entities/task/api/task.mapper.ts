import type { TimelineItemDto, TurnDto } from "@monitor/kernel";
import type { EventId, SessionId, TaskId } from "~web/shared/identity.js";
import type {
  MonitoringEventKind,
  TimelineEventRecord,
  TimelineLane,
} from "~web/entities/task/model/timeline/event.js";
import type { TaskTurnSummary } from "~web/entities/task/model/task-query.js";

export function toTimelineRecord(item: TimelineItemDto): TimelineEventRecord {
  return {
    id: item.id as EventId,
    taskId: item.taskId as TaskId,
    ...(item.sessionId !== undefined ? { sessionId: item.sessionId as SessionId } : {}),
    ...(item.turnId !== undefined ? { turnId: item.turnId } : {}),
    kind: item.kind as MonitoringEventKind,
    lane: item.lane as TimelineLane,
    title: item.displayTitle || item.title,
    ...(item.body !== undefined ? { body: item.body } : {}),
    metadata: item.metadata,
    paths: { filePaths: item.filePaths, mentionedPaths: [] },
    classification: { lane: item.lane as TimelineLane, tags: [] },
    createdAt: item.occurredAt,
  };
}

export function toTurnSummary(turn: TurnDto): TaskTurnSummary {
  return {
    id: turn.id,
    sessionId: turn.sessionId,
    taskId: turn.taskId,
    turnIndex: turn.turnIndex,
    status: turn.status as "open" | "closed",
    startedAt: turn.startedAt,
    endedAt: turn.endedAt,
    aggregateVerdict: turn.aggregateVerdict as TaskTurnSummary["aggregateVerdict"],
    rulesEvaluatedCount: turn.rulesEvaluatedCount,
  };
}
