import type { GuidanceLocale, GuidanceMessage } from "~web/shared/guidance.js";
import { formatAbsoluteHHmmss } from "~web/shared/lib/formatting/time.js";
import { Button, Field, Input, Select } from "~web/shared/ui/index.js";

export interface SavedSetting {
  readonly masked: string;
  readonly updatedAt: string;
}

interface SecretSettingFieldProps {
  readonly label: string;
  readonly help: GuidanceMessage;
  readonly locale: GuidanceLocale;
  readonly current: SavedSetting | undefined;
  readonly loading: boolean;
  readonly pending: boolean;
  readonly draft: string;
  readonly placeholder: string;
  readonly onDraftChange: (value: string) => void;
  readonly onSave: () => void;
  readonly onClear: () => void;
}

/** 공급자 비밀값의 마스킹 상태와 교체 입력을 함께 표시한다. */
export function SecretSettingField({
  label,
  help,
  locale,
  current,
  loading,
  pending,
  draft,
  placeholder,
  onDraftChange,
  onSave,
  onClear,
}: SecretSettingFieldProps) {
  return (
    <Field label={label} help={help} helpLocale={locale}>
      {loading ? (
        <span className="text-ink-muted text-sm">Loading…</span>
      ) : current ? (
        <div className="flex items-center gap-2 min-w-0">
          <code className="font-mono text-xs py-1 px-2 bg-s1 rounded-xs truncate max-w-60">
            {current.masked}
          </code>
          <span className="text-ink-tertiary text-[11px] whitespace-nowrap">
            saved {formatAbsoluteHHmmss(current.updatedAt)}
          </span>
          <Button variant="ghost" onClick={onClear} className="text-xs border-0 p-0 underline">
            Clear
          </Button>
        </div>
      ) : (
        <span className="text-ink-tertiary text-[12.5px]">Not set</span>
      )}
      <div className="flex gap-2 mt-2">
        <Input
          type="password"
          placeholder={placeholder}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          spellCheck={false}
          autoComplete="off"
          className="flex-1 font-mono"
        />
        <Button variant="solid" disabled={!draft.trim() || pending} onClick={onSave}>
          {current ? "Replace" : "Save"}
        </Button>
      </div>
    </Field>
  );
}

interface ModelSettingFieldProps {
  readonly label: string;
  readonly help: GuidanceMessage;
  readonly locale: GuidanceLocale;
  readonly current: SavedSetting | undefined;
  readonly pending: boolean;
  readonly draft: string;
  readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  readonly onDraftChange: (value: string) => void;
  readonly onSave: () => void;
  readonly onClear: () => void;
}

/** 공급자 모델 선택과 기본값 복원을 표시한다. */
export function ModelSettingField({
  label,
  help,
  locale,
  current,
  pending,
  draft,
  options,
  onDraftChange,
  onSave,
  onClear,
}: ModelSettingFieldProps) {
  return (
    <Field label={label} help={help} helpLocale={locale}>
      <div className="flex items-center gap-2">
        <Select value={draft || current?.masked || ""} onChange={(event) => onDraftChange(event.target.value)}>
          <option value="">{current ? current.masked : "(default)"}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
        <Button variant="ghost" disabled={!draft.trim() || pending} onClick={onSave}>
          Save
        </Button>
        {current ? (
          <Button variant="ghost" onClick={onClear} className="text-xs border-0 p-0 underline">
            Clear
          </Button>
        ) : null}
      </div>
    </Field>
  );
}
