import { cn } from "~web/shared/ui/lib/cn.js";
import { ChevronLeftIcon, ChevronRightIcon } from "~web/shared/ui/index.js";

interface PanelActionProps {
  readonly side: "left" | "right";
  readonly label: string;
  readonly onAction: () => void;
}

/** 접힌 데스크톱 패널을 복원하는 레일을 표시한다. */
export function CollapsedPanelRail({ side, label, onAction }: PanelActionProps) {
  return (
    <aside
      className={cn(
        "relative min-h-0 overflow-hidden bg-canvas",
        side === "left" ? "border-r border-hair" : "border-l border-hair",
      )}
      style={{ gridColumn: side === "left" ? "1 / 2" : "3 / 4" }}
    >
      <button
        type="button"
        onClick={onAction}
        aria-label={label}
        title={label}
        className="absolute inset-0 flex items-center justify-center text-ink-tertiary bg-transparent cursor-pointer"
      >
        {side === "left" ? <ChevronRightIcon /> : <ChevronLeftIcon />}
      </button>
    </aside>
  );
}

/** 펼친 데스크톱 패널을 접는 테두리 탭을 표시한다. */
export function CollapsePanelTab({ side, label, onAction }: PanelActionProps) {
  return (
    <button
      type="button"
      onClick={onAction}
      aria-label={label}
      title={label}
      className="absolute top-1/2 -translate-y-1/2 z-[12] inline-flex items-center justify-center h-7 w-5 rounded-xs bg-s1 border border-hair text-ink-tertiary cursor-pointer"
      style={{
        left: side === "left" ? "auto" : 4,
        right: side === "left" ? 4 : "auto",
      }}
    >
      {side === "left" ? <ChevronLeftIcon /> : <ChevronRightIcon />}
    </button>
  );
}
