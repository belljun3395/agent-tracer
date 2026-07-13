import { useEffect, useRef, useState } from "react";
import {
  useGuidance,
  useSidebarView,
  useSetSidebarView,
  type SidebarView,
} from "~web/shared/store/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import { ChevronDownIcon, GuidanceText } from "~web/shared/ui/index.js";

interface ViewOption {
  readonly value: SidebarView;
  readonly label: string;
  readonly guidanceKey: "taskView" | "subagentView";
}

const OPTIONS: readonly ViewOption[] = [
  {
    value: "tasks",
    label: "Tasks",
    guidanceKey: "taskView",
  },
  {
    value: "subagents",
    label: "Subagent tasks",
    guidanceKey: "subagentView",
  },
];

interface SidebarViewSwitcherProps {
  readonly subagentCount?: number;
}

/** 사이드바 상단의 간결한 드롭다운 행. */
export function SidebarViewSwitcher({ subagentCount }: SidebarViewSwitcherProps) {
  const guidance = useGuidance();
  const view = useSidebarView();
  const setView = useSetSidebarView();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = OPTIONS.find((o) => o.value === view) ?? OPTIONS[0]!;

  return (
    <div ref={ref} className="relative mx-3 mt-1 mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-[26px] items-center gap-1.5 rounded-sm px-2 hover:bg-s2 font-sans text-sm font-semibold text-ink tracking-[-0.1px]"
      >
        <span>{active.label}</span>
        {view === "subagents" && subagentCount !== undefined && (
          <span aria-hidden className="font-mono text-[10px] text-ink-tertiary">
            {subagentCount}
          </span>
        )}
        <ChevronDownIcon className="text-ink-tertiary" />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-[30px] z-20 w-[200px] overflow-hidden rounded-md border border-hair bg-canvas shadow-[var(--elev-1)]"
        >
          {OPTIONS.map((opt) => {
            const isActive = opt.value === view;
            return (
              <li key={opt.value} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  onClick={() => {
                    setView(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "block w-full px-2.5 py-2 text-left hover:bg-s2",
                    isActive ? "bg-s2" : "bg-transparent",
                  )}
                >
                  <div className="font-sans text-[12.5px] font-semibold text-ink flex items-center gap-1.5">
                    <span>{opt.label}</span>
                    {opt.value === "subagents" &&
                      subagentCount !== undefined && (
                        <span aria-hidden className="font-mono text-[10px] text-ink-tertiary">
                          {subagentCount}
                        </span>
                      )}
                  </div>
                  <GuidanceText
                    as="div"
                    className="font-sans text-[11px] text-ink-tertiary"
                    locale={guidance.locale}
                    message={guidance.messages.tasks[opt.guidanceKey]}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
