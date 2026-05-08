import { BrandMark } from "./BrandMark.js";
import { WsLivePill } from "./WsLivePill.js";
import { Crumbs } from "./Crumbs.js";
import { TopActions } from "./TopActions.js";

interface TopBarProps {
  readonly wsConnected: boolean;
}

export function TopBar({ wsConnected }: TopBarProps) {
  return (
    <div
      className="flex h-full items-center gap-3.5 px-4"
      style={{ background: "var(--canvas)" }}
    >
      <BrandMark />
      <WsLivePill connected={wsConnected} />
      <div className="flex-1 min-w-0">
        <Crumbs />
      </div>
      <div className="ml-auto flex items-center gap-1">
        <TopActions />
      </div>
    </div>
  );
}
