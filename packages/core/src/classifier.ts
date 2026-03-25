import type {
  EventClassification,
  EventClassificationMatch
} from "./domain/types.js";
import type { ClassifyEventInput } from "./classifier.types.js";
import { classifyActionName } from "./action-registry.js";
import { defaultLaneForEventKind } from "./domain/utils.js";
import { getCanonicalLane } from "./classifier.helpers.js";

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

export type { ClassifyEventInput } from "./classifier.types.js";
