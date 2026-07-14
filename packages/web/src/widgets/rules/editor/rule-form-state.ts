import type {
  RuleExpect,
  RuleExpectationKind,
  RuleExpectedAction,
  RuleRecord,
  RuleScope,
  RuleSeverity,
  RuleTriggerSource,
} from "~web/entities/rule/model/rule.js";
import { RULE_EXPECTATION_KIND } from "~web/entities/rule/model/rule.js";

/** 규칙 편집기의 입력 초안을 나타낸다. */
export interface RuleFormState {
  name: string;
  triggerPhrases: string;
  triggerOn: RuleTriggerSource | "";
  expectKind: RuleExpectationKind;
  expectTool: RuleExpectedAction | "";
  expectCommandMatches: string;
  expectPattern: string;
  scope: RuleScope;
  severity: RuleSeverity;
  rationale: string;
}

export type UpdateRuleForm = (changes: Partial<RuleFormState>) => void;

/** 저장된 규칙을 편집 가능한 폼 상태로 변환한다. */
export function createRuleFormState(
  rule: RuleRecord | undefined,
  fallbackScope: RuleScope,
): RuleFormState {
  if (!rule) {
    return {
      name: "",
      triggerPhrases: "",
      triggerOn: "",
      expectKind: RULE_EXPECTATION_KIND.command,
      expectTool: "",
      expectCommandMatches: "",
      expectPattern: "",
      scope: fallbackScope,
      severity: "warn",
      rationale: "",
    };
  }

  const expect = rule.expect;
  return {
    name: rule.name,
    triggerPhrases: (rule.trigger?.phrases ?? []).join("\n"),
    triggerOn: rule.triggerOn ?? "",
    expectKind: expect.kind,
    expectTool:
      expect.kind === RULE_EXPECTATION_KIND.pattern ||
      expect.kind === RULE_EXPECTATION_KIND.action
        ? expect.tool ?? ""
        : "",
    expectCommandMatches:
      expect.kind === RULE_EXPECTATION_KIND.command
        ? expect.commandMatches.join("\n")
        : "",
    expectPattern:
      expect.kind === RULE_EXPECTATION_KIND.pattern ? expect.pattern : "",
    scope: rule.scope,
    severity: rule.severity,
    rationale: rule.rationale ?? "",
  };
}

/** 폼 상태를 유효한 규칙 기대값으로 변환한다. */
export function buildRuleExpectation(form: RuleFormState): RuleExpect | null {
  const commandMatches = splitRuleFormLines(form.expectCommandMatches);
  const pattern = form.expectPattern.trim();
  const tool = form.expectTool;

  switch (form.expectKind) {
    case RULE_EXPECTATION_KIND.command:
      return commandMatches.length > 0
        ? { kind: RULE_EXPECTATION_KIND.command, commandMatches }
        : null;
    case RULE_EXPECTATION_KIND.pattern:
      return pattern
        ? {
            kind: RULE_EXPECTATION_KIND.pattern,
            pattern,
            ...(tool ? { tool } : {}),
          }
        : null;
    case RULE_EXPECTATION_KIND.action:
      return tool ? { kind: RULE_EXPECTATION_KIND.action, tool } : null;
  }
}

/** 여러 줄 입력을 중복 없는 비어 있지 않은 항목으로 변환한다. */
export function splitRuleFormLines(value: string): readonly string[] {
  const seen = new Set<string>();
  for (const raw of value.split(/\r?\n/)) {
    const item = raw.trim();
    if (item) seen.add(item);
  }
  return Array.from(seen);
}
