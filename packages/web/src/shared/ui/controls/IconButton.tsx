import type { ComponentPropsWithoutRef } from "react";
import { cn } from "~web/shared/ui/lib/cn.js";

type IconButtonTone = "neutral" | "danger";

interface IconButtonProps extends ComponentPropsWithoutRef<"button"> {
  readonly tone?: IconButtonTone;
  /** 2클릭 확인(useConfirmAction 참조)이 armed 상태인 동안 true. */
  readonly armed?: boolean;
}

const toneClass: Record<IconButtonTone, string> = {
  neutral: "text-ink-tertiary border-hair",
  danger: "text-err border-err",
};

export function IconButton({
  tone = "neutral",
  armed = false,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center h-[22px] w-[22px] rounded-xs border",
        "transition-colors disabled:opacity-40 disabled:pointer-events-none",
        armed ? "bg-err/14 text-err border-err" : toneClass[tone],
        className,
      )}
      {...rest}
    />
  );
}
