import { cn } from "../lib/cn.js";

export type StatusKind = "running" | "waiting" | "done" | "failed" | "idle";

interface StatusDotProps {
  readonly status: StatusKind;
  readonly className?: string;
  /** Adds a pulsing ping aura (used on running tasks in the task list). */
  readonly pulse?: boolean;
}

const colorByStatus: Record<StatusKind, string> = {
  running: "bg-[var(--primary)]",
  waiting: "bg-[var(--warn)]",
  done: "bg-[var(--ok)]",
  failed: "bg-[var(--err)]",
  idle: "bg-[var(--ink-tertiary)]",
};

export function StatusDot({ status, className, pulse = false }: StatusDotProps) {
  return (
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
}
