import type { RuleSeverity } from "~web/entities/rule/model/rule.js";
import type { TaskUserInput } from "~web/entities/task/model/task-query.js";
import type {
  GuidanceCatalog,
  GuidanceLocale,
} from "~web/shared/guidance.js";
import {
  RuleFormField,
  RuleFormRow,
  ruleFormInputClassName,
} from "~web/widgets/rules/editor/RuleFormControl.js";
import type { RuleFormState, UpdateRuleForm } from "~web/widgets/rules/editor/rule-form-state.js";

const SEVERITY_OPTIONS: readonly RuleSeverity[] = ["info", "warn", "block"];
const ANCHOR_PREVIEW_MAX = 70;

interface RuleBasicsFieldsProps {
  readonly form: RuleFormState;
  readonly userInputs: readonly TaskUserInput[];
  readonly isEdit: boolean;
  readonly disabled: boolean;
  readonly locale: GuidanceLocale;
  readonly messages: GuidanceCatalog["rules"]["form"];
  readonly onChange: UpdateRuleForm;
}

/** 규칙의 이름과 심각도와 검증 대상 발화를 편집한다. */
export function RuleBasicsFields({
  form,
  userInputs,
  isEdit,
  disabled,
  locale,
  messages,
  onChange,
}: RuleBasicsFieldsProps) {
  return (
    <>
      <RuleFormField label="Name" required>
        <input
          type="text"
          value={form.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Run the test suite"
          required
          disabled={disabled}
          className={ruleFormInputClassName}
        />
      </RuleFormField>

      <RuleFormField
        label="Verifies user input"
        required
        hint={messages.anchor}
        hintLocale={locale}
      >
        <select
          value={form.anchorEventId}
          onChange={(event) => onChange({ anchorEventId: event.target.value })}
          disabled={disabled || isEdit || userInputs.length === 0}
          required
          aria-label="User input this rule verifies"
          className={ruleFormInputClassName}
        >
          <option value="">Select a user input…</option>
          {userInputs.map((input, index) => (
            <option key={input.eventId} value={input.eventId}>
              {`#${index + 1} · ${truncateInput(input.text)}`}
            </option>
          ))}
        </select>
      </RuleFormField>

      <RuleFormRow>
        <RuleFormField label="Severity">
          <select
            value={form.severity}
            onChange={(event) =>
              onChange({ severity: event.target.value as RuleSeverity })
            }
            disabled={disabled}
            className={ruleFormInputClassName}
          >
            {SEVERITY_OPTIONS.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </select>
        </RuleFormField>
      </RuleFormRow>
    </>
  );
}

function truncateInput(text: string): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  return singleLine.length > ANCHOR_PREVIEW_MAX
    ? `${singleLine.slice(0, ANCHOR_PREVIEW_MAX)}…`
    : singleLine;
}
