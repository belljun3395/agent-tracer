import type { TaskId } from "~web/shared/identity.js";
import type { RuleScope, RuleSeverity } from "~web/entities/rule/model/rule.js";
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

interface RuleBasicsFieldsProps {
  readonly form: RuleFormState;
  readonly defaultTaskId: TaskId | undefined;
  readonly isEdit: boolean;
  readonly disabled: boolean;
  readonly locale: GuidanceLocale;
  readonly messages: GuidanceCatalog["rules"]["form"];
  readonly onChange: UpdateRuleForm;
}

/** 규칙의 이름과 심각도와 범위를 편집한다. */
export function RuleBasicsFields({
  form,
  defaultTaskId,
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
          placeholder="No raw secrets in commands"
          required
          disabled={disabled}
          className={ruleFormInputClassName}
        />
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
        <RuleFormField
          label="Scope"
          {...(isEdit
            ? { hint: messages.lockedScope, hintLocale: locale }
            : {})}
        >
          <select
            value={form.scope}
            onChange={(event) =>
              onChange({ scope: event.target.value as RuleScope })
            }
            disabled={disabled || isEdit}
            className={ruleFormInputClassName}
          >
            <option value="global">global</option>
            <option value="task" disabled={!defaultTaskId && !isEdit}>
              task{!defaultTaskId && !isEdit ? " (no task selected)" : ""}
            </option>
          </select>
        </RuleFormField>
      </RuleFormRow>
    </>
  );
}
