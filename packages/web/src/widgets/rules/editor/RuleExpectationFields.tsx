import type {
  RuleExpectationKind,
  RuleExpectedAction,
} from "~web/entities/rule/model/rule.js";
import { RULE_EXPECTATION_KIND } from "~web/entities/rule/model/rule.js";
import type {
  GuidanceCatalog,
  GuidanceLocale,
} from "~web/shared/guidance.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import {
  RuleFormField,
  RuleFormSectionHeading,
  ruleFormInputClassName,
  ruleFormTextareaClassName,
} from "~web/widgets/rules/editor/RuleFormControl.js";
import type { RuleFormState, UpdateRuleForm } from "~web/widgets/rules/editor/rule-form-state.js";

const EXPECT_TOOL_OPTIONS: readonly {
  value: RuleExpectedAction;
  label: string;
}[] = [
  { value: "command", label: "command — shell/bash execution" },
  { value: "file-read", label: "file-read — read, grep, glob, ls" },
  { value: "file-write", label: "file-write — edit, write, patch" },
  { value: "web", label: "web — fetch, search" },
];

const EXPECT_KIND_OPTIONS: readonly {
  value: RuleExpectationKind;
  label: string;
}[] = [
  { value: RULE_EXPECTATION_KIND.command, label: "command — literal commands" },
  { value: RULE_EXPECTATION_KIND.pattern, label: "pattern — regex match" },
  { value: RULE_EXPECTATION_KIND.action, label: "action — tool kind only" },
  {
    value: RULE_EXPECTATION_KIND.forbidden,
    label: "forbidden — prohibition only",
  },
];

interface RuleExpectationFieldsProps {
  readonly form: RuleFormState;
  readonly disabled: boolean;
  readonly locale: GuidanceLocale;
  readonly messages: GuidanceCatalog["rules"]["form"];
  readonly onChange: UpdateRuleForm;
}

/** 규칙이 요구하거나 금지할 동작의 형태와 조건을 편집한다. */
export function RuleExpectationFields({
  form,
  disabled,
  locale,
  messages,
  onChange,
}: RuleExpectationFieldsProps) {
  const selectsTool =
    form.expectKind === RULE_EXPECTATION_KIND.pattern ||
    form.expectKind === RULE_EXPECTATION_KIND.action;

  return (
    <>
      <RuleFormSectionHeading
        label="Expectation"
        hint={messages.expectation}
        hintLocale={locale}
      />
      <RuleFormField label="Kind" hint={messages.kind} hintLocale={locale}>
        <select
          value={form.expectKind}
          onChange={(event) =>
            onChange({
              expectKind: event.target.value as RuleExpectationKind,
            })
          }
          disabled={disabled}
          className={ruleFormInputClassName}
        >
          {EXPECT_KIND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </RuleFormField>

      {selectsTool && (
        <RuleFormField
          label="Tool name"
          hint={messages.toolName}
          hintLocale={locale}
        >
          <select
            value={form.expectTool}
            onChange={(event) =>
              onChange({
                expectTool: event.target.value as RuleExpectedAction | "",
              })
            }
            disabled={disabled}
            className={ruleFormInputClassName}
          >
            <option value="">(none)</option>
            {EXPECT_TOOL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </RuleFormField>
      )}

      {form.expectKind === RULE_EXPECTATION_KIND.command && (
        <RuleFormField
          label="Command matches"
          hint={messages.commandMatches}
          hintLocale={locale}
        >
          <textarea
            value={form.expectCommandMatches}
            onChange={(event) =>
              onChange({ expectCommandMatches: event.target.value })
            }
            rows={2}
            disabled={disabled}
            placeholder={`migrate up\ndb:seed`}
            className={ruleFormTextareaClassName}
          />
        </RuleFormField>
      )}

      {form.expectKind === RULE_EXPECTATION_KIND.pattern && (
        <RuleFormField
          label="Pattern"
          hint={messages.pattern}
          hintLocale={locale}
        >
          <input
            type="text"
            value={form.expectPattern}
            onChange={(event) =>
              onChange({ expectPattern: event.target.value })
            }
            disabled={disabled}
            placeholder="^(?!sk-).*"
            className={cn(ruleFormInputClassName, "font-mono")}
          />
        </RuleFormField>
      )}

      <RuleFormField
        label="Forbidden matches"
        hint={messages.forbiddenMatches}
        hintLocale={locale}
      >
        <textarea
          value={form.expectForbiddenMatches}
          onChange={(event) =>
            onChange({ expectForbiddenMatches: event.target.value })
          }
          rows={2}
          disabled={disabled}
          placeholder={`--force\nrm -rf`}
          className={ruleFormTextareaClassName}
        />
      </RuleFormField>
    </>
  );
}
