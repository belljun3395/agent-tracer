import type { EventClassificationMatch, EventClassificationReason } from "./domain/types.js";
import { ACTION_KEYWORD_RULES, ACTION_PREFIX_RULES, ACTION_SKIP_WORDS } from "./action-registry.constants.js";

/** actionName을 분류하여 레인, 태그, 이유를 포함한 매치 결과를 반환. 매치 없으면 null. */
export function classifyActionName(actionName?: string): EventClassificationMatch | null {
  if (!actionName) {
    return null;
  }

  const tokens = tokenizeActionName(actionName);

  if (tokens.length === 0) {
    return null;
  }

  const reasons: EventClassificationReason[] = [];
  const tags = new Set<string>(["action-registry"]);
  let score = 0;

  const prefixRule = ACTION_PREFIX_RULES.find((rule) => rule.prefixes.includes(tokens[0] ?? ""));
  if (prefixRule) {
    reasons.push({
      kind: "action-prefix",
      value: tokens[0] ?? ""
    });
    score += 4;
    for (const tag of prefixRule.tags) {
      tags.add(tag);
    }
  }

  const keywordMatches = ACTION_KEYWORD_RULES
    .map((rule) => ({
      rule,
      keywords: rule.keywords.filter((keyword: string) => tokens.includes(keyword))
    }))
    .filter((entry) => entry.keywords.length > 0);

  for (const match of keywordMatches) {
    for (const keyword of match.keywords) {
      reasons.push({
        kind: "action-keyword",
        value: keyword
      });
      score += 3;
    }

    for (const tag of match.rule.tags) {
      tags.add(tag);
    }
  }

  const winningKeywordRule = keywordMatches
    .sort((left, right) => right.keywords.length - left.keywords.length)[0]?.rule;

  const lane = winningKeywordRule?.lane ?? prefixRule?.lane;

  if (!lane) {
    return null;
  }

  return {
    ruleId: "action-registry",
    source: "action-registry",
    score,
    lane,
    tags: [...tags],
    reasons
  };
}

/** actionName 문자열을 소문자 토큰 배열로 분리. camelCase, snake_case, 특수문자 구분자 지원. 앞의 skip word 제거. */
export function tokenizeActionName(actionName: string): readonly string[] {
  const tokens = actionName
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);

  const firstNonSkip = tokens.findIndex((t) => !ACTION_SKIP_WORDS.has(t));
  return firstNonSkip === -1 ? [] : tokens.slice(firstNonSkip);
}
