import { cn } from "~web/shared/ui/lib/cn.js";
import { Hairline } from "~web/widgets/feed/timeline/Hairline.js";

const COMPACT_HAIR = "color-mix(in srgb, var(--compact) 50%, transparent)";

interface TimeMarkProps {
  readonly label: string;
  readonly tone?: "normal" | "compact";
  /** 선택적 반복 횟수. */
  readonly count?: number;
}

/** 피드 섹션 사이 가로 구분선. */
export function TimeMark({ label, tone = "normal", count }: TimeMarkProps) {
  const isCompact = tone === "compact";
  const showCount = typeof count === "number" && count > 1;
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 py-3",
        "text-[10.5px] uppercase tracking-[0.04em] font-[var(--font-mono)]",
      )}
      style={{ color: isCompact ? "var(--warn)" : "var(--ink-tertiary)" }}
    >
      <Hairline color={isCompact ? COMPACT_HAIR : "var(--hair)"} />
      <span>
        — {label}
        {showCount && (
          <span className="ml-1.5 text-warn">×{count}</span>
        )}{" "}
        —
      </span>
      <Hairline color={isCompact ? COMPACT_HAIR : "var(--hair)"} />
    </div>
  );
}

