import type {
  EventClassification,
  EventClassificationMatch,
  MonitoringEventKind,
  TimelineLane
} from "./domain.js";
import { classifyActionName } from "./action-registry.js";
import { defaultLaneForEventKind } from "./domain.js";

/** classifyEvent()에 전달하는 이벤트 분류 입력 데이터. */
export interface ClassifyEventInput {
  readonly kind: MonitoringEventKind;
  readonly title?: string;
  readonly body?: string;
  readonly command?: string;
  readonly toolName?: string;
  readonly actionName?: string;
  readonly filePaths?: readonly string[];
  readonly lane?: TimelineLane;
}

/**
 * 이벤트를 분류하여 레인, 태그, 매치 목록을 포함한 EventClassification을 반환.
 * 명시적 lane이 있으면 action-registry 매치보다 우선하여 사용됨.
 */
export function classifyEvent(
  input: ClassifyEventInput
): EventClassification {
  const actionMatch = classifyActionName(input.actionName);

  const matches: EventClassificationMatch[] = actionMatch ? [actionMatch] : [];

  const canonicalLane = getCanonicalLane(input.kind);

  return {
    lane: input.lane ?? canonicalLane ?? matches.find((match) => match.lane)?.lane ?? defaultLaneForEventKind(input.kind),
    tags: [...new Set(matches.flatMap((match) => match.tags))],
    matches
  };
}

function getCanonicalLane(kind: MonitoringEventKind): TimelineLane | undefined {
  if (kind === "user.message" || kind === "task.start" || kind === "task.complete" || kind === "task.error") {
    return defaultLaneForEventKind(kind);
  }

  return undefined;
}

