import type { ReactNode } from "react";
import type { GuidanceLocale, GuidanceMessage } from "~web/shared/guidance.js";
import { DEFAULT_GUIDANCE_LOCALE } from "~web/shared/guidance-locale.js";
import { GuidanceText } from "~web/shared/GuidanceText.js";

interface EmptyViewProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: GuidanceMessage;
  /** description을 렌더링할 언어. */
  readonly locale?: GuidanceLocale;
  /** 선택적 복구 액션(예: 404 빈 상태의 "Back to tasks" 링크). */
  readonly action?: ReactNode;
}

/** 전체 화면 빈 상태. */
export function EmptyView({
  eyebrow,
  title,
  description,
  locale = DEFAULT_GUIDANCE_LOCALE,
  action,
}: EmptyViewProps) {
  return (
    <div className="flex h-full items-center justify-center text-center">
      <div className="max-w-[440px] px-6">
        {eyebrow && (
          <div className="font-mono text-[10.5px] text-ink-tertiary uppercase tracking-[0.1em]">
            {eyebrow}
          </div>
        )}
        <h1 className="mt-3 m-0 text-[22px] font-semibold tracking-[-0.4px] text-ink">
          {title}
        </h1>
        {description && (
          <GuidanceText
            as="p"
            className="mt-2 text-ink-subtle text-[13px] leading-[1.55]"
            locale={locale}
            message={description}
          />
        )}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
