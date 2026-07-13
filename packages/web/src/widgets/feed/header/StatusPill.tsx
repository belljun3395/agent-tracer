import { useState, useRef, useEffect } from "react";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import { useUpdateTaskMutation } from "~web/entities/task/api/edit-mutations.js";
import { AnchoredPopover, Pill } from "~web/shared/ui/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";

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

/** 클릭해서 상태를 바꾸는 필. */
export function StatusPill({ task }: StatusPillProps) {
  const mutation = useUpdateTaskMutation();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !wrapperRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const change = (status: Status) => {
    setOpen(false);
    if (status === task.status) return;
    mutation.mutate({ taskId: task.id, body: { status } });
  };

  const tone = STATUS_TONE[task.status];
  const isLive = task.status === "running" || task.status === "waiting";

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change task status"
        className="bg-transparent border-0 p-0 cursor-pointer"
      >
        <Pill tone={tone} dot pulse={isLive}>
          {STATUS_LABEL[task.status]} ▾
        </Pill>
      </button>
      {open && (
        <AnchoredPopover
          ref={popoverRef}
          anchorRef={anchorRef}
          role="listbox"
          aria-label="Task status"
          preferredWidth={160}
          preferredMaxHeight={240}
          gap={4}
          className="bg-s1 border border-hair rounded-sm p-1 shadow-[0_4px_12px_rgba(0,0,0,0.4)] flex flex-col gap-0.5"
        >
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={s === task.status}
              onClick={() => change(s)}
              disabled={mutation.isPending}
              className={cn(
                "flex items-center gap-2 py-1.5 px-2 border-0 rounded-xs cursor-pointer text-ink-muted font-mono text-[11px] text-left w-full",
                s === task.status ? "bg-s2" : "bg-transparent",
              )}
            >
              <StatusDotInline status={s} />
              <span>{STATUS_LABEL[s]}</span>
              {s === task.status && (
                <span className="ml-auto text-[10px] text-ink-tertiary">
                  current
                </span>
              )}
            </button>
          ))}
        </AnchoredPopover>
      )}
    </div>
  );
}

const STATUS_DOT_COLOR: Record<Status, string> = {
  running: "bg-primary",
  waiting: "bg-warn",
  completed: "bg-ok",
  errored: "bg-err",
};

function StatusDotInline({ status }: { status: Status }) {
  return (
    <span
      aria-hidden
      className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT_COLOR[status])}
    />
  );
}
