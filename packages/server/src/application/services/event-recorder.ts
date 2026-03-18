/**
 * @module application/services/event-recorder
 *
 * 이벤트 삽입·파일 derived 이벤트 생성 서비스.
 */

import {
  classifyEvent,
  type MonitoringEventKind,
  type TimelineEvent,
  type TimelineLane
} from "@monitor/core";

import type { IEventRepository } from "../ports/event-repository.js";
import type { INotificationPublisher } from "../ports/notification-publisher.js";
import type { IRulesCatalog } from "../ports/rules-catalog.js";
import type { GenericEventInput } from "../types.js";
import { TraceMetadataFactory } from "./trace-metadata-factory.js";

export class EventRecorder {
  constructor(
    private readonly events: IEventRepository,
    private readonly rules: IRulesCatalog,
    private readonly notifier: INotificationPublisher
  ) {}

  async record(input: GenericEventInput): Promise<TimelineEvent> {
    const createdAt = new Date().toISOString();
    const classification = classifyEvent(
      {
        kind: input.kind,
        title: input.title,
        ...(input.lane ? { lane: input.lane as TimelineLane } : {}),
        ...(input.body ? { body: input.body } : {}),
        ...(input.command ? { command: input.command } : {}),
        ...(input.toolName ? { toolName: input.toolName } : {}),
        ...(input.actionName ? { actionName: input.actionName } : {}),
        ...(input.filePaths ? { filePaths: input.filePaths } : {})
      },
      this.rules.getIndex()
    );
    const contextualTags = TraceMetadataFactory.deriveTags(input);

    const event = await this.events.insert({
      id: globalThis.crypto.randomUUID(),
      taskId: input.taskId,
      kind: input.kind,
      lane: classification.lane,
      title: input.title,
      metadata: TraceMetadataFactory.build(
        {
          ...(input.metadata ?? {}),
          filePaths: input.filePaths ?? []
        },
        input
      ),
      classification: {
        ...classification,
        tags: [...new Set([...classification.tags, ...contextualTags])]
      },
      createdAt,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      ...(input.body ? { body: input.body } : {})
    });

    this.notifier.publish({ type: "event.logged", payload: event });
    return event;
  }

  async recordWithDerivedFiles(input: GenericEventInput): Promise<{
    sessionId?: string;
    events: readonly { id: string; kind: MonitoringEventKind }[];
  }> {
    const primaryEvent = await this.record(input);
    const derivedEventPromises = (input.filePaths ?? []).map((filePath) =>
      this.record({
        taskId: input.taskId,
        kind: "file.changed",
        title: filePath.split("/").at(-1) ?? filePath,
        body: filePath,
        filePaths: [filePath],
        metadata: {
          sourceKind: input.kind,
          sourceEventId: primaryEvent.id
        },
        ...(input.sessionId ? { sessionId: input.sessionId } : {})
      })
    );
    const derivedEvents = await Promise.all(derivedEventPromises);

    return {
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      events: [primaryEvent, ...derivedEvents].map((event) => ({
        id: event.id,
        kind: event.kind
      }))
    };
  }
}
