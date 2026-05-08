import { useState, useRef, useEffect } from "react";
import type { MonitoringTask } from "~domain/monitoring.js";
import { useUpdateTaskMutation } from "~state/server/mutations.js";
import { Pill } from "~ui/index.js";

type Status = MonitoringTask["status"];

interface StatusPillProps {
  readonly task: MonitoringTask;
}

const STATUS_TONE: Record<Status, "primary" | "warn" | "ok" | "err"> = {
  running: "primary",
  waiting: "warn",
  completed: "ok",
  errored: "err",
};

const STATUS_LABEL: Record<Status, string> = {
  running: "Running",
  waiting: "Awaiting input",
  completed: "Completed",
  errored: "Errored",
};

const STATUSES: readonly Status[] = [
  "running",
  "waiting",
  "completed",
  "errored",
];

/**
 * Click-to-change status pill. Mirrors v6's "Running · cycle 4/?" pattern
 * but adds a popover so operators can manually mark a stuck task as
 * completed / errored, or restart a completed run as running.
 *
 * Click the pill to open a small dropdown; pick a status; the mutation
 * fires and optimistic update lands instantly.
 */
export function StatusPill({ task }: StatusPillProps) {
  const mutation = useUpdateTaskMutation();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click — keeps the popover transient.
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const change = (status: Status) => {
    setOpen(false);
    if (status === task.status) return;
    mutation.mutate({ taskId: task.id, body: { status } });
  };

  const tone = STATUS_TONE[task.status];
  const isLive = task.status === "running" || task.status === "waiting";

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change task status"
        style={{
          background: "transparent",
          border: 0,
          padding: 0,
          cursor: "pointer",
        }}
      >
        <Pill tone={tone} dot pulse={isLive}>
          {STATUS_LABEL[task.status]} ▾
        </Pill>
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 20,
            background: "var(--s1)",
            border: "1px solid var(--hair)",
            borderRadius: "var(--radius-sm)",
            padding: 4,
            minWidth: 160,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={s === task.status}
              onClick={() => change(s)}
              disabled={mutation.isPending}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 8px",
                background: s === task.status ? "var(--s2)" : "transparent",
                border: 0,
                borderRadius: "var(--radius-xs)",
                cursor: "pointer",
                color: "var(--ink-muted)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                textAlign: "left",
                width: "100%",
              }}
            >
              <StatusDotInline status={s} />
              <span>{STATUS_LABEL[s]}</span>
              {s === task.status && (
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 10,
                    color: "var(--ink-tertiary)",
                  }}
                >
                  current
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusDotInline({ status }: { status: Status }) {
  const color =
    status === "running"
      ? "var(--primary)"
      : status === "waiting"
        ? "var(--warn)"
        : status === "completed"
          ? "var(--ok)"
          : "var(--err)";
  return (
    <span
      aria-hidden
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
    />
  );
}
