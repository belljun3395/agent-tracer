import type { ComponentPropsWithoutRef } from "react";
import { cn } from "~web/shared/ui/lib/cn.js";

type PillTone = "neutral" | "ok" | "warn" | "err" | "primary";

interface PillProps extends ComponentPropsWithoutRef<"span"> {
  readonly tone?: PillTone;
  /** tone과 맞는 색의 작은 상태 dot을 앞에 표시한다. */
  readonly dot?: boolean;
  /** 앞의 dot을 펄스시킨다(`dot`이 true일 때만 적용). */
  readonly pulse?: boolean;
}

const toneText: Record<PillTone, string> = {
  neutral: "text-[var(--ink-subtle)]",
  ok: "text-[var(--ok)]",
  warn: "text-[var(--warn)]",
  err: "text-[var(--err)]",
  primary: "text-[var(--primary-hover)]",
};

const toneDot: Record<PillTone, string> = {
  neutral: "bg-[var(--ink-subtle)]",
  ok: "bg-[var(--ok)]",
  warn: "bg-[var(--warn)]",
  err: "bg-[var(--err)]",
  primary: "bg-[var(--primary)]",
};

export function Pill({ tone = "neutral", dot = false, pulse = false, className, children, ...rest }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)]",
        "border border-[var(--hair)] bg-transparent",
        "px-2 py-[2px] text-[10.5px] font-[var(--font-mono)]",
        toneText[tone],
        className,
      )}
      {...rest}
    >
      {dot && (
        <span
          aria-hidden
          className={cn("h-[5px] w-[5px] rounded-full", toneDot[tone])}
          style={pulse ? { animation: "pulse 1.8s ease-in-out infinite" } : undefined}
        />
      )}
      {children}
    </span>
  );
}
