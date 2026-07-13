import type { RuleMatchedBy } from "~web/entities/rule/model/rule-evidence.js";

export function ruleMatchedByLabel(l: RuleMatchedBy): string {
  switch (l) {
    case "action":
      return "action";
    case "commandMatch":
      return "cmd";
    case "pattern":
      return "regex";
    case "trigger-phrase":
      return "phrase";
  }
}
