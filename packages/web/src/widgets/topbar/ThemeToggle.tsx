import { useEffect, useRef, useState } from "react";
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon, Tooltip } from "~web/shared/ui/index.js";
import { useSetTheme, useTheme, type Theme } from "~web/shared/store/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";

/** 팝오버가 달린 단일 버튼 테마 전환기. */
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
          className={cn(
            "h-7 w-7 inline-flex items-center justify-center rounded-sm hover:bg-s1 transition-colors text-ink-muted",
            open ? "bg-s1" : "bg-transparent",
          )}
        >
          {triggerIcon}
        </button>
      </Tooltip>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[148px] rounded-sm py-1 bg-s1 border border-hair shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
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
      className={cn(
        "w-full flex items-center gap-2 px-2.5 h-7 text-left hover:bg-s2 text-[12.5px]",
        active ? "text-ink bg-s2" : "text-ink-muted bg-transparent",
      )}
    >
      <span className="text-ink-tertiary">{icon}</span>
      <span className="flex-1">{label}</span>
      {active && <CheckIcon size={12} className="text-primary" />}
    </button>
  );
}

// 호출자를 위해 재수출한다.
export type { Theme };
