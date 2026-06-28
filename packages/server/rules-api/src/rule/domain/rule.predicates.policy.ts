import { RULE_SCOPE } from "./const/rule.const.js";
import type { Rule } from "./type/rule.type.js";

// task 스코프이면서 대상 taskId가 있는 룰 — task 한정 백필/평가 대상.
export function isTaskScopedRule(rule: Rule): rule is Rule & { taskId: string } {
    return rule.scope === RULE_SCOPE.task && typeof rule.taskId === "string" && rule.taskId.length > 0;
}
