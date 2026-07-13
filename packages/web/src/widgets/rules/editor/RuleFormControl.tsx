import type { ReactNode } from "react";
import type {
  GuidanceLocale,
  GuidanceMessage,
} from "~web/shared/guidance.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import { GuidanceText } from "~web/shared/ui/index.js";

interface RuleFormFieldPropsBase {
  readonly label: string;
  readonly required?: boolean;
  readonly children: ReactNode;
}

type RuleFormFieldProps = RuleFormFieldPropsBase &
  (
    | {
        readonly hint: GuidanceMessage;
        readonly hintLocale: GuidanceLocale;
      }
    | {
        readonly hint?: never;
        readonly hintLocale?: never;
      }
  );

/** 규칙 폼의 라벨과 선택적 안내 문구를 같은 배치로 표시한다. */
export function RuleFormField({
  label,
  hint,
  hintLocale,
  required,
  children,
}: RuleFormFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-tertiary">
        {label}
        {required && <span className="text-err"> *</span>}
      </span>
      {children}
      {hint && (
        <GuidanceText
          className="text-[11px] text-ink-subtle leading-[1.4]"
          locale={hintLocale}
          message={hint}
        />
      )}
    </label>
  );
}

/** 규칙 폼의 필드 그룹 제목과 안내 문구를 표시한다. */
export function RuleFormSectionHeading({
  label,
  hint,
  hintLocale,
}: {
  readonly label: string;
  readonly hint: GuidanceMessage;
  readonly hintLocale: GuidanceLocale;
}) {
  return (
    <div className="mt-1.5 pt-2 border-t border-hair flex flex-col gap-0.5">
      <span className="text-[12.5px] font-semibold text-ink tracking-[-0.05px]">
        {label}
      </span>
      <GuidanceText
        className="text-[11px] text-ink-subtle leading-[1.4]"
        locale={hintLocale}
        message={hint}
      />
    </div>
  );
}

/** 연관된 규칙 폼 필드 두 개를 같은 행에 배치한다. */
export function RuleFormRow({ children }: { readonly children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

export const ruleFormInputClassName =
  "w-full py-[7px] px-2.5 text-[12.5px] font-[inherit] text-ink bg-canvas border border-hair rounded-xs outline-none";

export const ruleFormTextareaClassName = cn(
  ruleFormInputClassName,
  "resize-y font-mono text-xs leading-[1.5]",
);
