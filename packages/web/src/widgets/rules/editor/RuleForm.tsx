import { useState } from "react";
import type {
  RuleCreateInput,
  RuleRecord,
  RuleUpdateInput,
} from "~web/entities/rule/model/rule.js";
import type { TaskId } from "~web/shared/identity.js";
import {
  useCreateRuleMutation,
  useUpdateRuleMutation,
} from "~web/entities/rule/api/mutations.js";
import { useTaskUserInputsQuery } from "~web/entities/task/api/detail-queries.js";
import type { GuidanceMessage } from "~web/shared/guidance.js";
import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText } from "~web/shared/ui/index.js";
import { RuleBasicsFields } from "~web/widgets/rules/editor/RuleBasicsFields.js";
import { RuleExpectationFields } from "~web/widgets/rules/editor/RuleExpectationFields.js";
import {
  RuleFormField,
  ruleFormTextareaClassName,
} from "~web/widgets/rules/editor/RuleFormControl.js";
import {
  buildRuleExpectation,
  createRuleFormState,
  type RuleFormState,
} from "~web/widgets/rules/editor/rule-form-state.js";

interface RuleFormProps {
  readonly rule?: RuleRecord;
  readonly taskId: TaskId;
  readonly onClose: () => void;
}

type FormError =
  | { readonly kind: "guidance"; readonly message: GuidanceMessage }
  | { readonly kind: "raw"; readonly message: string };

/** 규칙 생성과 수정의 폼 상태와 저장 흐름을 조율한다. */
export function RuleForm({ rule, taskId, onClose }: RuleFormProps) {
  const guidance = useGuidance();
  const isEdit = Boolean(rule);
  const userInputs = useTaskUserInputsQuery(taskId).data ?? [];
  const [form, setForm] = useState<RuleFormState>(() =>
    createRuleFormState(rule, ""),
  );
  const [error, setError] = useState<FormError | null>(null);
  const createMutation = useCreateRuleMutation();
  const updateMutation = useUpdateRuleMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const messages = guidance.messages.rules.form;

  const updateForm = (changes: Partial<RuleFormState>) => {
    setForm((current) => ({ ...current, ...changes }));
  };

  const handleSubmit = (event: { readonly preventDefault: () => void }) => {
    event.preventDefault();
    setError(null);

    const name = form.name.trim();
    if (!name) {
      setError({ kind: "guidance", message: messages.nameRequired });
      return;
    }

    const expectation = buildRuleExpectation(form);
    if (expectation === null) {
      setError({ kind: "guidance", message: messages.expectationRequired });
      return;
    }

    const rationale = form.rationale.trim();

    if (isEdit && rule) {
      const body: RuleUpdateInput = {
        name,
        expect: expectation,
        severity: form.severity,
        rationale: rationale || null,
      };
      updateMutation.mutate(
        { ruleId: rule.id, body },
        {
          onSuccess: onClose,
          onError: (mutationError) =>
            setError({
              kind: "raw",
              message:
                mutationError instanceof Error
                  ? mutationError.message
                  : "Update failed.",
            }),
        },
      );
      return;
    }

    if (!form.anchorEventId) {
      setError({ kind: "guidance", message: messages.anchorRequired });
      return;
    }

    const body: RuleCreateInput = {
      name,
      expect: expectation,
      taskId,
      anchorEventId: form.anchorEventId,
      severity: form.severity,
      ...(rationale ? { rationale } : {}),
    };
    createMutation.mutate(body, {
      onSuccess: onClose,
      onError: (mutationError) =>
        setError({
          kind: "raw",
          message:
            mutationError instanceof Error
              ? mutationError.message
              : "Create failed.",
        }),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="pt-4 px-4 pb-0 flex flex-col gap-3.5"
    >
      <RuleBasicsFields
        form={form}
        userInputs={userInputs}
        isEdit={isEdit}
        disabled={isPending}
        locale={guidance.locale}
        messages={messages}
        onChange={updateForm}
      />
      <RuleExpectationFields
        form={form}
        disabled={isPending}
        locale={guidance.locale}
        messages={messages}
        onChange={updateForm}
      />
      <RuleFormField
        label="Rationale"
        hint={messages.rationale}
        hintLocale={guidance.locale}
      >
        <textarea
          value={form.rationale}
          onChange={(event) => updateForm({ rationale: event.target.value })}
          rows={3}
          disabled={isPending}
          className={ruleFormTextareaClassName}
        />
      </RuleFormField>

      {error && (
        <div role="alert" className="m-0 text-xs text-err leading-[1.5]">
          {error.kind === "guidance" ? (
            <GuidanceText locale={guidance.locale} message={error.message} />
          ) : (
            error.message
          )}
        </div>
      )}

      <footer className="sticky bottom-0 -mx-4 mt-1 py-3 px-4 flex justify-end gap-2 bg-s1 border-t border-hair">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className={ghostButtonClassName}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className={primaryButtonClassName}
        >
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Create rule"}
        </button>
      </footer>
    </form>
  );
}

const primaryButtonClassName =
  "py-[7px] px-3.5 text-[12.5px] font-medium text-canvas bg-primary border border-primary rounded-xs cursor-pointer";

const ghostButtonClassName =
  "py-[7px] px-3 text-[12.5px] text-ink-muted bg-transparent border border-hair rounded-xs cursor-pointer";
