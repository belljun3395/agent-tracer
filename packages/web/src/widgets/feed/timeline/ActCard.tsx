import { useEffect, useRef } from "react";
import {
  useSelectedEventId,
  useSetSelectedEventId,
} from "~web/shared/store/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import type { ActVm } from "~web/widgets/feed/lib/timeline/act-classification.js";
import { ActHeader } from "~web/widgets/feed/timeline/ActHeader.js";
import { ActMeta } from "~web/widgets/feed/timeline/ActMeta.js";

interface ActCardProps {
  readonly vm: ActVm;
}

/** 세로 피드의 행 하나. */
export function ActCard({ vm }: ActCardProps) {
  const selectedEventId = useSelectedEventId();
  const setSelectedEventId = useSetSelectedEventId();
  const active = selectedEventId === vm.event.id;
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!active) return;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [active]);

  return (
    <article
      ref={ref}
      onClick={() => setSelectedEventId(vm.event.id)}
      className={cn(
        "grid grid-cols-[64px_1fr] gap-3.5 py-1.5 cursor-pointer",
        "[animation:slidein_0.25s_ease-out]",
      )}
    >
      <div className="text-right pt-2 leading-[1.4] font-mono text-ink-tertiary">
        <div className="text-[11px]">{vm.clockLabel}</div>
        <div className="text-[10px] opacity-65 mt-0.5">
          {vm.offsetLabel}
        </div>
      </div>

      <div className="relative min-w-0">
        <div
          className={cn(
            "rounded-md pl-3.5 pr-3.5 py-2.5 transition-colors relative overflow-hidden bg-s1 text-ink",
            "border border-hair hover:border-hair-strong",
            active && "border-primary-focus shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary-focus)_35%,transparent)]",
          )}
        >
          {/* 같은 레인의 카드를 세로로 묶어 보이게 하는 레인 색 왼쪽 테두리다. */}
          <span
            aria-hidden
            className="absolute left-0 top-0 bottom-0 w-[3px] opacity-85"
            style={{ background: vm.lane.cssColor }}
          />
          <ActHeader vm={vm} />
          {vm.bodyText && (
            <div className="mt-1 text-[13.5px] leading-[1.5] text-ink tracking-[-0.1px]">
              {vm.bodyText}
            </div>
          )}
          <ActMeta vm={vm} />
        </div>
      </div>
    </article>
  );
}
