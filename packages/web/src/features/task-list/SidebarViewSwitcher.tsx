import { useEffect, useRef, useState } from "react";
import {
  useSidebarView,
  useSetSidebarView,
  type SidebarView,
} from "~state/ui/index.js";

interface ViewOption {
  readonly value: SidebarView;
  readonly label: string;
  readonly description: string;
}

const OPTIONS: readonly ViewOption[] = [
  {
    value: "tasks",
    label: "Tasks",
    description: "Sessions you ran",
  },
  {
    value: "subagents",
    label: "Subagent tasks",
    description: "Server SDK jobs",
  },
];

interface SidebarViewSwitcherProps {
  readonly subagentCount?: number;
}

/**
 * Compact dropdown row at the top of the sidebar — toggles between
 * user-driven Tasks and server-initiated Subagent tasks. The two lists
 * never mix; switching reloads the partition of the task list below.
 */
export function SidebarViewSwitcher({ subagentCount }: SidebarViewSwitcherProps) {
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
        className="inline-flex h-[26px] items-center gap-1.5 rounded-[var(--radius-sm)] px-2 hover:bg-[var(--s2)]"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ink)",
          letterSpacing: "-0.1px",
        }}
      >
        <span>{active.label}</span>
        {view === "subagents" && subagentCount !== undefined && (
          <span
            aria-hidden
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--ink-tertiary)",
            }}
          >
            {subagentCount}
          </span>
        )}
        <Chevron />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-[30px] z-20 w-[200px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--hair)] bg-[var(--canvas)] shadow-[var(--elev-1)]"
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
                  className="block w-full px-2.5 py-2 text-left hover:bg-[var(--s2)]"
                  style={{
                    background: isActive ? "var(--s2)" : "transparent",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "var(--ink)",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>{opt.label}</span>
                    {opt.value === "subagents" &&
                      subagentCount !== undefined && (
                        <span
                          aria-hidden
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 10,
                            color: "var(--ink-tertiary)",
                          }}
                        >
                          {subagentCount}
                        </span>
                      )}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 11,
                      color: "var(--ink-tertiary)",
                    }}
                  >
                    {opt.description}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chevron() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ color: "var(--ink-tertiary)" }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
