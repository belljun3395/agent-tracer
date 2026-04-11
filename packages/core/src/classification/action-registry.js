import { RuleId } from "./ids.js";
import { ACTION_KEYWORD_RULES, ACTION_PREFIX_RULES, ACTION_SKIP_WORDS } from "./action-registry.constants.js";
/**
 * Scores an action name against the action registry and returns the best lane hint.
 */
export function classifyActionName(actionName) {
    if (!actionName) {
        return null;
    }
    const tokens = tokenizeActionName(actionName);
    if (tokens.length === 0) {
        return null;
    }
    const reasons = [];
    const tags = new Set(["action-registry"]);
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
        keywords: rule.keywords.filter((keyword) => tokens.includes(keyword))
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
        ruleId: RuleId("action-registry"),
        source: "action-registry",
        score,
        lane,
        tags: [...tags],
        reasons
    };
}
/**
 * Splits an action name into normalized tokens while discarding ignorable prefixes.
 */
export function tokenizeActionName(actionName) {
    const tokens = actionName
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .filter(Boolean);
    const firstNonSkip = tokens.findIndex((t) => !ACTION_SKIP_WORDS.has(t));
    return firstNonSkip === -1 ? [] : tokens.slice(firstNonSkip);
}
//# sourceMappingURL=action-registry.js.map