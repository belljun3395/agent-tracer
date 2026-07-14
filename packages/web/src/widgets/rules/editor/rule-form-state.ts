import type {
  RuleExpect,
  RuleExpectationKind,
  RuleExpectedAction,
  RuleRecord,
  RuleSeverity,
} from "~web/entities/rule/model/rule.js";
import { RULE_EXPECTATION_KIND } from "~web/entities/rule/model/rule.js";

/** 규칙 편집기의 입력 초안을 나타낸다. */
export interface RuleFormState {
  name: string;
  /** 규칙이 검증하는 사용자 발화이며 판정 창이 여기서 시작한다. */
  anchorEventId: string;
  expectKind: RuleExpectationKind;
  expectTool: RuleExpectedAction | "";
  expectCommandMatches: string;
  expectPattern: string;
  severity: RuleSeverity;
  rationale: string;
}

export type UpdateRuleForm = (changes: Partial<RuleFormState>) => void;

/** 저장된 규칙을 편집 가능한 폼 상태로 변환한다. */
export function createRuleFormState(
  rule: RuleRecord | undefined,
  fallbackAnchorEventId: string,
): RuleFormState {
  if (!rule) {
    return {
      name: "",
      anchorEventId: fallbackAnchorEventId,
      expectKind: RULE_EXPECTATION_KIND.command,
      expectTool: "",
      expectCommandMatches: "",
      expectPattern: "",
      severity: "warn",
      rationale: "",
    };
  }

  const expect = rule.expect;
  return {
    name: rule.name,
    anchorEventId: rule.anchorEventId,
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
