import { Tooltip } from "./Tooltip.js";
import { cn } from "../lib/cn.js";

export type StatusKind = "running" | "waiting" | "done" | "failed" | "idle";

interface StatusDotProps {
  readonly status: StatusKind;
  readonly className?: string;
  /** Adds a pulsing ping aura (used on running tasks in the task list). */
  readonly pulse?: boolean;
  /**
   * Optional supplemental detail shown after the status name in the
   * tooltip — e.g. `"started 1m ago"`. Status mapping is always shown;
   * pass extra context here, not the status itself.
   */
  readonly detail?: string;
  /**
   * Suppress the hover tooltip. Use for instances where the dot is
   * already inside a larger labelled element (e.g. filter pills that
   * carry their own label + count).
   */
  readonly tooltip?: false;
}

const colorByStatus: Record<StatusKind, string> = {
  running: "bg-[var(--primary)]",
  waiting: "bg-[var(--warn)]",
  done: "bg-[var(--ok)]",
  failed: "bg-[var(--err)]",
  idle: "bg-[var(--ink-tertiary)]",
};

/**
 * Plain-English explanation of each status. Surfaced as the dot's
 * hover tooltip so operators don't have to memorise the colour mapping
 * (which the audit flagged as the single biggest "what does this mean?"
 * pain across the dashboard).
 */
const labelByStatus: Record<StatusKind, string> = {
  running: "Running — the agent is actively producing events",
  waiting: "Waiting for input — the agent has paused for a user prompt",
  done: "Done — the task finished cleanly",
  failed: "Errored — the task ended in failure",
  idle: "Idle — no recent activity",
};

export function StatusDot({
  status,
  className,
  pulse = false,
  detail,
  tooltip,
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

  const content = detail
    ? `${labelByStatus[status]} · ${detail}`
    : labelByStatus[status];
  return (
    <Tooltip content={content} side="top">
      {dot}
    </Tooltip>
  );
}
