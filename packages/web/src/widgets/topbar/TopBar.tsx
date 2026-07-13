import {
  useInspectorDrawerOpen,
  useSelectedTaskId,
  useSetInspectorDrawerOpen,
  useSetSidebarDrawerOpen,
  useSidebarDrawerOpen,
} from "~web/shared/store/index.js";
import type { ViewportTier } from "~web/shared/lib/hooks/use-viewport.js";
import { HamburgerIcon, PanelRightIcon, Tooltip } from "~web/shared/ui/index.js";
import { BrandMark } from "~web/widgets/topbar/BrandMark.js";
import { WsLivePill } from "~web/widgets/topbar/WsLivePill.js";
import { Crumbs } from "~web/widgets/topbar/Crumbs.js";
import { TopActions } from "~web/widgets/topbar/TopActions.js";

interface TopBarProps {
  readonly wsConnected: boolean;
  /** 생략 가능. */
  readonly viewport?: ViewportTier;
}

export function TopBar({ wsConnected, viewport = "wide" }: TopBarProps) {
  const isCompact = viewport !== "wide";
  return (
    <div className="flex h-full items-center gap-2 px-3 sm:gap-3.5 sm:px-4 bg-canvas">
      {/* 사이드바 토글은 가장 좁은 화면 티어에서만 의미가 있다. */}
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
        className="inline-flex h-7 w-7 items-center justify-center rounded-xs border border-hair text-ink-muted bg-canvas"
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
        className="inline-flex h-7 w-7 items-center justify-center rounded-xs border border-hair text-ink-muted bg-canvas"
      >
        <PanelRightIcon />
      </button>
    </Tooltip>
  );
}
