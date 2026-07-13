import type { RuleTriggerSource } from "~web/entities/rule/model/rule.js";
import type {
  GuidanceCatalog,
  GuidanceLocale,
} from "~web/shared/guidance.js";
import {
  RuleFormField,
  RuleFormSectionHeading,
  ruleFormInputClassName,
  ruleFormTextareaClassName,
} from "~web/widgets/rules/editor/RuleFormControl.js";
import type { RuleFormState, UpdateRuleForm } from "~web/widgets/rules/editor/rule-form-state.js";

const TRIGGER_ON_OPTIONS: readonly RuleTriggerSource[] = ["user", "assistant"];

interface RuleTriggerFieldsProps {
  readonly form: RuleFormState;
  readonly disabled: boolean;
  readonly locale: GuidanceLocale;
  readonly messages: GuidanceCatalog["rules"]["form"];
  readonly onChange: UpdateRuleForm;
}

/** 규칙을 활성화할 문구와 대화 주체를 편집한다. */
export function RuleTriggerFields({
  form,
  disabled,
  locale,
  messages,
  onChange,
}: RuleTriggerFieldsProps) {
  return (
    <>
      <RuleFormSectionHeading
        label="Trigger"
        hint={messages.trigger}
        hintLocale={locale}
      />
      <RuleFormField
        label="Phrases"
        hint={messages.phrases}
        hintLocale={locale}
      >
        <textarea
          value={form.triggerPhrases}
          onChange={(event) =>
            onChange({ triggerPhrases: event.target.value })
          }
          rows={2}
          disabled={disabled}
          placeholder={`run the migration\napply the patch`}
          className={ruleFormTextareaClassName}
        />
      </RuleFormField>

      <RuleFormField
        label="Source"
        hint={messages.source}
        hintLocale={locale}
      >
        <select
          value={form.triggerOn}
          onChange={(event) =>
            onChange({
              triggerOn: event.target.value as RuleTriggerSource | "",
            })
          }
          disabled={disabled}
          className={ruleFormInputClassName}
        >
          <option value="">any</option>
          {TRIGGER_ON_OPTIONS.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
      </RuleFormField>
    </>
  );
}
