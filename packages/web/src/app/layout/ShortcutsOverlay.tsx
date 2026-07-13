import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  useGuidance,
  useSetShortcutsOpen,
  useShortcutsOpen,
} from "~web/shared/store/index.js";
import { GuidanceText } from "~web/shared/ui/index.js";

interface ShortcutRow {
  readonly keys: readonly string[];
  readonly guidanceKey: "focusSearch" | "nextTask" | "previousTask" | "rulesPage" | "dismiss" | "showPanel";
}

const NAVIGATION: readonly ShortcutRow[] = [
  { keys: ["/"], guidanceKey: "focusSearch" },
  { keys: ["j"], guidanceKey: "nextTask" },
  { keys: ["k"], guidanceKey: "previousTask" },
  { keys: ["g"], guidanceKey: "rulesPage" },
  { keys: ["Esc"], guidanceKey: "dismiss" },
  { keys: ["?"], guidanceKey: "showPanel" },
];

/** 키보드 단축키 치트시트. */
export function ShortcutsOverlay() {
  const guidance = useGuidance();
  const open = useShortcutsOpen();
  const setOpen = useSetShortcutsOpen();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      className="fixed inset-0 z-[1100] flex items-center justify-center overflow-y-auto bg-canvas/70 backdrop-blur-[4px] p-4"
    >
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[460px] flex-col overflow-hidden bg-s1 border border-hair rounded-md shadow-[0_20px_50px_-10px_rgba(0,0,0,0.6)]">
        <header className="shrink-0 px-4 py-3.5 border-b border-hair flex flex-wrap items-baseline gap-2">
          <h2 className="m-0 text-[13px] font-semibold tracking-[-0.1px]">
            Keyboard shortcuts
          </h2>
          <GuidanceText
            className="text-[11px] text-ink-subtle"
            locale={guidance.locale}
            message={guidance.messages.shell.shortcutToggle}
          />
        </header>
        <ul className="m-0 min-h-0 overflow-y-auto pt-2 px-4 pb-3.5 list-none">
          {NAVIGATION.map((row) => (
            <li
              key={row.keys.join("+")}
              className="flex items-center gap-3 py-1.5 text-[12.5px] text-ink"
            >
              <span className="shrink-0 min-w-14 inline-flex gap-1">
                {row.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
              <GuidanceText
                className="text-ink-muted"
                locale={guidance.locale}
                message={guidance.messages.shell.shortcuts[row.guidanceKey]}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

function Kbd({ children }: { readonly children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 font-mono text-[11px] text-ink bg-s2 border border-hair-strong border-b-2 rounded">
      {children}
    </kbd>
  );
}
