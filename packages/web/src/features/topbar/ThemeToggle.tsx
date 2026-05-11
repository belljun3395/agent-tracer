import { useEffect, useRef, useState } from "react";
import { Tooltip } from "~ui/index.js";
import { useSetTheme, useTheme, type Theme } from "~state/ui/index.js";

/**
 * Single-button theme switcher with a popover. The previous three-segment
 * dark/light/auto bar consumed three icon slots in an already crowded
 * topbar; collapsing into one icon-button + popover matches the
 * Linear / Notion / Vercel pattern and frees up horizontal space for
 * the responsive drawer toggles next to it.
 */
export function ThemeToggle() {
  const theme = useTheme();
  const setTheme = useSetTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const triggerIcon =
    theme === "dark" ? <MoonIcon /> : theme === "light" ? <SunIcon /> : <MonitorIcon />;
  const triggerLabel =
    theme === "dark"
      ? "Theme: dark"
      : theme === "light"
        ? "Theme: light"
        : "Theme: follow system";

  return (
    <div className="relative" ref={rootRef}>
      <Tooltip content="Change theme" side="bottom">
        <button
          type="button"
          aria-label={triggerLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="h-7 w-7 inline-flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--s1)] transition-colors"
          style={{
            color: "var(--ink-muted)",
            background: open ? "var(--s1)" : "transparent",
          }}
        >
          {triggerIcon}
        </button>
      </Tooltip>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[148px] rounded-[var(--radius-sm)] py-1"
          style={{
            background: "var(--s1)",
            border: "1px solid var(--hair)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }}
        >
          <MenuItem
            label="Light"
            active={theme === "light"}
            onSelect={() => {
              setTheme("light");
              setOpen(false);
            }}
            icon={<SunIcon />}
          />
          <MenuItem
            label="Dark"
            active={theme === "dark"}
            onSelect={() => {
              setTheme("dark");
              setOpen(false);
            }}
            icon={<MoonIcon />}
          />
          <MenuItem
            label="Follow system"
            active={theme === "system"}
            onSelect={() => {
              setTheme("system");
              setOpen(false);
            }}
            icon={<MonitorIcon />}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  active,
  onSelect,
  icon,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly onSelect: () => void;
  readonly icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onSelect}
      className="w-full flex items-center gap-2 px-2.5 h-7 text-left hover:bg-[var(--s2)]"
      style={{
        fontSize: 12.5,
        color: active ? "var(--ink)" : "var(--ink-muted)",
        background: active ? "var(--s2)" : "transparent",
      }}
    >
      <span style={{ color: "var(--ink-tertiary)" }}>{icon}</span>
      <span className="flex-1">{label}</span>
      {active && <CheckIcon />}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--primary)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// All icons are 14×14 single-stroke Lucide-style — match TopBar density.

function MoonIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

// Re-export for callers — keeps the topbar's public surface contained.
export type { Theme };
