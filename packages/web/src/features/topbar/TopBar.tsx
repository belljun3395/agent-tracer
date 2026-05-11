import {
  useInspectorDrawerOpen,
  useSelectedTaskId,
  useSetInspectorDrawerOpen,
  useSetSidebarDrawerOpen,
  useSidebarDrawerOpen,
} from "~state/ui/index.js";
import type { ViewportTier } from "~lib/use-viewport.js";
import { Tooltip } from "~ui/index.js";
import { BrandMark } from "./BrandMark.js";
import { WsLivePill } from "./WsLivePill.js";
import { Crumbs } from "./Crumbs.js";
import { TopActions } from "./TopActions.js";

interface TopBarProps {
  readonly wsConnected: boolean;
  /** Optional — when omitted the bar renders in `wide` mode. */
  readonly viewport?: ViewportTier;
}

export function TopBar({ wsConnected, viewport = "wide" }: TopBarProps) {
  const isCompact = viewport !== "wide";
  return (
    <div
      className="flex h-full items-center gap-2 px-3 sm:gap-3.5 sm:px-4"
      style={{ background: "var(--canvas)" }}
    >
      {/* Mobile-only hamburger — narrow keeps the sidebar pinned, so the
          toggle is only meaningful on the smallest tier. */}
      {viewport === "mobile" && <SidebarToggle />}
      <BrandMark />
      <WsLivePill connected={wsConnected} />
      {!isCompact && (
        <div className="flex-1 min-w-0">
          <Crumbs />
        </div>
      )}
      <div className="ml-auto flex items-center gap-1">
        <TopActions />
        {isCompact && <InspectorToggle />}
      </div>
    </div>
  );
}

function SidebarToggle() {
  const open = useSidebarDrawerOpen();
  const setOpen = useSetSidebarDrawerOpen();
  return (
    <Tooltip content="Toggle task list" side="bottom">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close task list" : "Open task list"}
        aria-pressed={open}
        className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-xs)] border border-[var(--hair)]"
        style={{ color: "var(--ink-muted)", background: "var(--canvas)" }}
      >
        <HamburgerIcon />
      </button>
    </Tooltip>
  );
}

function InspectorToggle() {
  const selectedTaskId = useSelectedTaskId();
  const open = useInspectorDrawerOpen();
  const setOpen = useSetInspectorDrawerOpen();
  if (!selectedTaskId) return null;
  return (
    <Tooltip content="Toggle inspector" side="bottom">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close inspector" : "Open inspector"}
        aria-pressed={open}
        className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-xs)] border border-[var(--hair)]"
        style={{ color: "var(--ink-muted)", background: "var(--canvas)" }}
      >
        <PanelRightIcon />
      </button>
    </Tooltip>
  );
}

function HamburgerIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function PanelRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  );
}
