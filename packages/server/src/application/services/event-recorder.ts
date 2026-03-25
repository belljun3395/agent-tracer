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
import type { GenericEventInput } from "../types.js";
import { TraceMetadataFactory } from "./trace-metadata-factory.js";

export class EventRecorder {
  constructor(
    private readonly events: IEventRepository,
    private readonly notifier: INotificationPublisher
  ) {}

  async record(input: GenericEventInput): Promise<TimelineEvent> {
    const createdAt = new Date().toISOString();
    const filePaths = normalizeFilePaths(input.filePaths);
    const classification = classifyEvent(
      {
        kind: input.kind,
        title: input.title,
        ...(input.lane ? { lane: input.lane as TimelineLane } : {}),
        ...(input.body ? { body: input.body } : {}),
        ...(input.command ? { command: input.command } : {}),
        ...(input.toolName ? { toolName: input.toolName } : {}),
        ...(input.actionName ? { actionName: input.actionName } : {}),
        ...(filePaths.length > 0 ? { filePaths } : {})
      }
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
          filePaths
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
    const filePaths = normalizeFilePaths(input.filePaths);
    const primaryEvent = await this.record({
      ...input,
      ...(filePaths.length > 0 ? { filePaths } : {})
    });
    // exploration/background 레인은 tool.used 이벤트로 충분히 표현되므로 file.changed 파생 이벤트를 생성하지 않는다.
    // exploration: 탐색 도구(Read/Glob/Grep)는 tool.used 하나로 표현. file.changed가 추가되면 레인이 노이즈로 가득 참.
    // background: 배경 세션의 파일 접근은 background 레인에 이미 기록됨. exploration에 file.changed 누수를 방지.
    if (primaryEvent.lane === "exploration" || primaryEvent.lane === "background") {
      return {
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        events: [{ id: primaryEvent.id, kind: primaryEvent.kind }]
      };
    }
    // 검색 도구(grep/glob류)에서 오는 대량 filePaths가 file.changed 이벤트를 폭발시키는 것을 방지.
    // 상한을 초과하는 경우 처음 MAX_DERIVED_FILES개만 파생 이벤트로 생성하고 나머지는 버린다.
    const MAX_DERIVED_FILES = 15;
    const derivedPaths = filePaths.slice(0, MAX_DERIVED_FILES);
    const derivedEventPromises = derivedPaths.map((filePath) =>
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

function normalizeFilePaths(filePaths: readonly string[] | undefined): readonly string[] {
  if (!filePaths || filePaths.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const filePath of filePaths) {
    const trimmed = filePath.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}
