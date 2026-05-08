import { Tooltip } from "~ui/index.js";
import { useSetTheme, useTheme, type Theme } from "~state/ui/index.js";
import { cn } from "~lib/cn.js";

/**
 * Three-segment theme toggle: dark / light / auto (auto = follow OS).
 *
 * Mirrors the Feed/Graph view-toggle pattern in TaskHeader — same
 * 6/24px height, same active treatment — so the topbar feels coherent.
 */
export function ThemeToggle() {
  const theme = useTheme();
  const setTheme = useSetTheme();

  return (
    <div
      className="inline-flex p-0.5 rounded-[var(--radius-sm)]"
      style={{
        background: "var(--s1)",
        border: "1px solid var(--hair)",
      }}
    >
      <Segment
        active={theme === "dark"}
        onClick={() => setTheme("dark")}
        label="Dark"
        ariaLabel="Use dark theme"
      >
        <MoonIcon />
      </Segment>
      <Segment
        active={theme === "light"}
        onClick={() => setTheme("light")}
        label="Light"
        ariaLabel="Use light theme"
      >
        <SunIcon />
      </Segment>
      <Tooltip content="Follow system preference" side="bottom">
        <Segment
          active={theme === "system"}
          onClick={() => setTheme("system")}
          label="Auto"
          ariaLabel="Follow system color scheme"
        >
          <MonitorIcon />
        </Segment>
      </Tooltip>
    </div>
  );
}

interface SegmentProps {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly label: string;
  readonly ariaLabel: string;
  readonly children: React.ReactNode;
}

function Segment({ active, onClick, label, ariaLabel, children }: SegmentProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={cn(
        "h-6 w-7 rounded-[var(--radius-xs)] inline-flex items-center justify-center",
        "transition-colors",
      )}
      style={{
        background: active ? "var(--s3)" : "transparent",
        color: active ? "var(--ink)" : "var(--ink-subtle)",
        boxShadow: active ? "0 1px 0 0 var(--hair-strong)" : "none",
      }}
      title={label}
    >
      {children}
    </button>
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
