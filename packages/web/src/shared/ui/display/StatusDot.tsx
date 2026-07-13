import type { ReactNode } from "react";
import { Tooltip } from "~web/shared/ui/overlays/Tooltip.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import type { StatusKind } from "~web/shared/ui/lib/status-kind.js";

interface StatusDotBaseProps {
  readonly status: StatusKind;
  readonly className?: string;
  /** 펄스치는 ping 오라를 추가한다(태스크 목록의 실행 중 태스크에 사용). */
  readonly pulse?: boolean;
  /**
   * 툴팁에서 상태명 뒤에 붙는 선택적 보충 정보(예: `"started 1m ago"`).
   * 상태 매핑은 항상 표시되므로 여기에는 추가 맥락만 전달한다.
   */
  readonly detail?: string;
}

type StatusDotProps = StatusDotBaseProps &
  (
    | {
        /** 상태 설명 툴팁의 내용은 상태를 소유한 소비자가 주입한다. */
        readonly tooltipContent: ReactNode;
        readonly tooltip?: true;
      }
    | {
        /** 더 큰 레이블 요소가 상태 설명을 이미 제공할 때 툴팁을 숨긴다. */
        readonly tooltip: false;
        readonly tooltipContent?: never;
      }
  );

const colorByStatus: Record<StatusKind, string> = {
  running: "bg-[var(--primary)]",
  waiting: "bg-[var(--warn)]",
  done: "bg-[var(--ok)]",
  failed: "bg-[var(--err)]",
  idle: "bg-[var(--ink-tertiary)]",
  canceled: "bg-[var(--ink-tertiary)]",
};

/** 상태 색상과 소비자가 주입한 설명을 함께 표시한다. */
export function StatusDot({
  status,
  className,
  pulse = false,
  detail,
  tooltip,
  tooltipContent,
}: StatusDotProps) {
  const dot = (
    <span
      aria-label={`status: ${status}`}
      className={cn(
        "relative inline-block h-[7px] w-[7px] rounded-full shrink-0",
        colorByStatus[status],
        className,
      )}
    >
      {pulse && status === "running" && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-[var(--primary)]"
          style={{ animation: "ping 1.8s cubic-bezier(0,0,.2,1) infinite" }}
        />
      )}
    </span>
  );

  if (tooltip === false) return dot;

  return (
    <Tooltip
      content={
        <span>
          {tooltipContent}
          {detail ? ` · ${detail}` : null}
        </span>
      }
      side="top"
    >
      {dot}
    </Tooltip>
  );
}
