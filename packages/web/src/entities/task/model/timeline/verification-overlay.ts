import { KIND } from "@monitor/kernel";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import type { TaskVerification } from "~web/entities/task/model/timeline/verification.js";

export interface VerificationOverlayEntry {
  readonly moveToVeri: boolean;
  readonly verifications: readonly TaskVerification[];
}

interface MutableOverlayEntry {
  moveToVeri: boolean;
  readonly verifications: TaskVerification[];
  readonly verificationIds: Set<string>;
}

/** 검증 결과를 원본 타임라인 이벤트에 연결한다. */
export function buildVerificationOverlay(
  events: readonly TimelineEventRecord[],
  verifications: readonly TaskVerification[],
): ReadonlyMap<string, VerificationOverlayEntry> {
  const eventIds = new Set(events.map((event) => event.id as string));
  const finalResponses = finalAssistantResponsesByTurn(events);
  const entries = new Map<string, MutableOverlayEntry>();

  for (const verification of verifications) {
    if (verification.matchedEventIds.length > 0) {
      for (const matchedEventId of verification.matchedEventIds) {
        if (!eventIds.has(matchedEventId)) continue;
        addVerification(entries, matchedEventId, verification, true);
      }
      continue;
    }

    const anchorEventId = verification.triggerEventId !== undefined
      && eventIds.has(verification.triggerEventId)
      ? verification.triggerEventId
      : finalResponses.get(verification.turnId)?.id;
    if (anchorEventId === undefined) continue;
    addVerification(entries, anchorEventId, verification, false);
  }

  return new Map(
    [...entries].map(([eventId, entry]) => [
      eventId,
      Object.freeze({
        moveToVeri: entry.moveToVeri,
        verifications: Object.freeze([...entry.verifications]),
      }),
    ]),
  );
}

function addVerification(
  entries: Map<string, MutableOverlayEntry>,
  eventId: string,
  verification: TaskVerification,
  moveToVeri: boolean,
): void {
  const entry = entries.get(eventId) ?? {
    moveToVeri: false,
    verifications: [],
    verificationIds: new Set<string>(),
  };
  entry.moveToVeri ||= moveToVeri;
  if (!entry.verificationIds.has(verification.id)) {
    entry.verificationIds.add(verification.id);
    entry.verifications.push(verification);
  }
  entries.set(eventId, entry);
}

function finalAssistantResponsesByTurn(
  events: readonly TimelineEventRecord[],
): ReadonlyMap<string, TimelineEventRecord> {
  const responses = new Map<string, TimelineEventRecord>();
  for (const event of events) {
    if (event.turnId === undefined || event.kind !== KIND.assistantResponse) continue;
    const current = responses.get(event.turnId);
    if (current === undefined || Date.parse(event.createdAt) >= Date.parse(current.createdAt)) {
      responses.set(event.turnId, event);
    }
  }
  return responses;
}
