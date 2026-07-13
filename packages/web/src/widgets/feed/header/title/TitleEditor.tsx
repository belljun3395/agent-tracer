import type { ChangeEventHandler, KeyboardEventHandler, RefObject } from "react";
import { useGuidance } from "~web/shared/store/index.js";
import {
  GuidanceText,
  PencilSimpleIcon,
  Tooltip,
} from "~web/shared/ui/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";

interface TitleEditorProps {
  readonly editing: boolean;
  readonly draft: string;
  readonly current: string;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly saving: boolean;
  readonly disabled: boolean;
  readonly onDraftChange: ChangeEventHandler<HTMLInputElement>;
  readonly onKeyDown: KeyboardEventHandler<HTMLInputElement>;
  readonly onBlur: () => void;
  readonly onStart: () => void;
}

const TITLE_CLASS_NAME =
  "m-0 text-[22px] font-semibold tracking-[-0.4px] leading-[1.25] text-ink min-w-0";

/** 태스크 제목의 읽기 모드와 인라인 입력 표면을 제공한다. */
export function TitleEditor({
  editing,
  draft,
  current,
  inputRef,
  saving,
  disabled,
  onDraftChange,
  onKeyDown,
  onBlur,
  onStart,
}: TitleEditorProps) {
  const guidance = useGuidance();

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={onDraftChange}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        disabled={saving}
        className={cn(
          TITLE_CLASS_NAME,
          "flex-1 min-w-0 bg-s1 border border-primary rounded-sm py-0.5 px-2 outline-none",
          saving ? "opacity-60" : "opacity-100",
        )}
        aria-label="Task title"
      />
    );
  }

  return (
    <h1 className={cn(TITLE_CLASS_NAME, "grow shrink basis-0 max-w-full")}>
      <Tooltip
        content={
          <GuidanceText
            locale={guidance.locale}
            message={guidance.messages.feed.clickToRename}
          />
        }
        side="bottom"
      >
        <button
          type="button"
          disabled={disabled}
          onClick={onStart}
          aria-busy={disabled}
          aria-label={`Edit task title: ${current}`}
          className={cn(
            "group w-full min-w-0 rounded-sm border-0 bg-transparent flex items-center gap-1.5 py-0.5 px-1.5 -my-0.5 -mx-1.5 text-left text-[inherit] font-[inherit] leading-[inherit] tracking-[inherit] text-ink transition-colors duration-[120ms]",
            disabled ? "cursor-wait" : "cursor-pointer hover:bg-s1",
          )}
        >
          <span
            className={cn(
              "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap underline-offset-[3px] decoration-hair-strong transition-opacity duration-150",
              disabled
                ? "opacity-55"
                : "opacity-100 group-hover:underline",
            )}
          >
            {current}
          </span>
          <span
            aria-hidden
            className={cn(
              "shrink-0 text-ink-tertiary transition-opacity duration-150",
              disabled
                ? "hidden"
                : "hidden group-hover:inline-flex group-focus-visible:inline-flex items-center",
            )}
          >
            <PencilSimpleIcon />
          </span>
        </button>
      </Tooltip>
    </h1>
  );
}
