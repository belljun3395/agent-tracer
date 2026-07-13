import type { EventKind, EventLane } from "@monitor/kernel";
import type { EventId, SessionId, TaskId } from "~web/shared/identity.js";
import type { TimelineEventSemantic } from "~web/entities/task/model/timeline/classification.js";
import type { TimelineEventPaths } from "~web/entities/task/model/timeline/paths.js";

export type TimelineLane = EventLane;
export type MonitoringEventKind = EventKind;

export interface EventClassification {
  readonly lane: TimelineLane;
  readonly tags: readonly string[];
}

export interface TimelineEventRecord {
  readonly id: EventId;
  readonly taskId: TaskId;
  readonly sessionId?: SessionId;
  readonly turnId?: string;
  readonly kind: MonitoringEventKind;
  readonly lane: TimelineLane;
  readonly title: string;
  readonly body?: string;
  readonly metadata: Record<string, unknown>;
  readonly semantic?: TimelineEventSemantic;
  readonly paths?: TimelineEventPaths;
  readonly classification: EventClassification;
  readonly createdAt: string;
}
