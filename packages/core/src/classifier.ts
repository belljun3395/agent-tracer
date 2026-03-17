import type {
  EventClassification,
  EventClassificationMatch,
  EventClassificationReason,
  MonitoringEventKind,
  TimelineLane
} from "./domain.js";
import { classifyActionName } from "./action-registry.js";
import { defaultLaneForEventKind } from "./domain.js";
import {
  collectRuleKeywords,
  collectRulePrefixes,
  lanePriority,
  type RulesIndex
} from "./rules.js";

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
 * 규칙의 prefix 매치는 +5점, keyword 매치는 +2점으로 점수 계산.
 * 명시적 lane이 있으면 규칙 매치보다 우선하여 사용됨.
 */
export function classifyEvent(
  input: ClassifyEventInput,
  rulesIndex: RulesIndex
): EventClassification {
  const searchText = [
    input.title,
    input.body,
    input.command,
    input.toolName,
    input.actionName,
    ...(input.filePaths ?? [])
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  const normalizedPaths = (input.filePaths ?? []).map((value) => value.toLowerCase());
  const actionMatch = classifyActionName(input.actionName);

  const matches = rulesIndex.rules
    .map((rule) => classifyRule(rule, searchText, normalizedPaths))
    .filter((match): match is EventClassificationMatch => match !== null)
    .concat(actionMatch ? [actionMatch] : [])
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return lanePriority(right.lane ?? "user") - lanePriority(left.lane ?? "user");
    });

  return {
    lane: input.lane ?? matches.find((match) => match.lane)?.lane ?? defaultLaneForEventKind(input.kind),
    tags: [...new Set(matches.flatMap((match) => match.tags))],
    matches
  };
}

function classifyRule(
  rule: RulesIndex["rules"][number],
  searchText: string,
  normalizedPaths: readonly string[]
): EventClassificationMatch | null {
  const reasons: EventClassificationReason[] = [];
  let score = 0;

  for (const prefix of collectRulePrefixes(rule)) {
    // Support both relative ("packages/web/src/foo") and absolute paths ("/home/.../packages/web/src/foo")
    if (normalizedPaths.some((value) => value.startsWith(prefix) || value.includes("/" + prefix))) {
      reasons.push({
        kind: "prefix",
        value: prefix
      });
      score += 5;
    }
  }

  for (const keyword of collectRuleKeywords(rule)) {
    if (searchText.includes(keyword)) {
      reasons.push({
        kind: "keyword",
        value: keyword
      });
      score += 2;
    }
  }

  if (score === 0) {
    return null;
  }

  return {
    ruleId: rule.id,
    source: "rules-index",
    score,
    tags: rule.tags,
    reasons,
    ...(rule.lane ? { lane: rule.lane } : {})
  };
}
