import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  useSetShortcutsOpen,
  useShortcutsOpen,
} from "~state/ui/index.js";

interface ShortcutRow {
  readonly keys: readonly string[];
  readonly description: string;
}

const NAVIGATION: readonly ShortcutRow[] = [
  { keys: ["/"], description: "Focus the sidebar search input" },
  { keys: ["j"], description: "Move to the next task" },
  { keys: ["k"], description: "Move to the previous task" },
  { keys: ["g"], description: "Go to the workspace Rules page" },
  { keys: ["Esc"], description: "Clear the search input or dismiss a drawer" },
  { keys: ["?"], description: "Show / hide this shortcuts panel" },
];

/**
 * Keyboard-shortcut cheatsheet. Visibility is driven by the layout
 * slice — `?` key toggles, footer `?` chip also toggles, Esc closes,
 * backdrop closes.
 *
 * Rendered into a portal so it overlays the entire shell regardless of
 * which panel currently has focus.
 */
export function ShortcutsOverlay() {
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
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "color-mix(in srgb, var(--canvas) 70%, transparent)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "var(--s1)",
          border: "1px solid var(--hair)",
          borderRadius: "var(--radius-md)",
          boxShadow: "0 20px 50px -10px rgba(0,0,0,0.6)",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--hair)",
            display: "flex",
            alignItems: "baseline",
            gap: 8,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "-0.1px",
            }}
          >
            Keyboard shortcuts
          </h2>
          <span
            style={{
              fontSize: 11,
              color: "var(--ink-subtle)",
            }}
          >
            Press <Kbd>?</Kbd> any time to toggle this panel.
          </span>
        </header>
        <ul style={{ margin: 0, padding: "8px 16px 14px", listStyle: "none" }}>
          {NAVIGATION.map((row) => (
            <li
              key={row.keys.join("+")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "6px 0",
                fontSize: 12.5,
                color: "var(--ink)",
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  minWidth: 56,
                  display: "inline-flex",
                  gap: 4,
                }}
              >
                {row.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
              <span style={{ color: "var(--ink-muted)" }}>{row.description}</span>
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
    <kbd
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 22,
        height: 20,
        padding: "0 6px",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--ink)",
        background: "var(--s2)",
        border: "1px solid var(--hair-strong)",
        borderBottomWidth: 2,
        borderRadius: 4,
      }}
    >
      {children}
    </kbd>
  );
}
