import { useEffect, useRef } from "react";
import {
  useSelectedEventId,
  useSetSelectedEventId,
} from "~state/ui/index.js";
import { cn } from "~lib/cn.js";
import type { ActVm } from "./lib/act-classification.js";
import { ActHeader } from "./ActHeader.js";
import { ActMeta } from "./ActMeta.js";

interface ActCardProps {
  readonly vm: ActVm;
}

/**
 * One row in the vertical feed: 64px clock column + 1fr card body. The
 * lane-colored dot sits to the left of the card body, marking the event
 * on the implicit timeline rail.
 *
 * Click selects the event for the Inspector pane; selection highlight is
 * a subtle border accent so the row stays scannable.
 *
 * Self-scroll: when this card becomes the active selection (e.g. user
 * picked the corresponding span in the Trace tab) and is offscreen, pull
 * it into view. `block: 'nearest'` keeps clicks on already-visible cards
 * still — only off-screen activations trigger an actual scroll.
 */
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
        "grid gap-3.5 py-1.5 cursor-pointer",
        "[animation:slidein_0.25s_ease-out]",
      )}
      style={{ gridTemplateColumns: "64px 1fr" }}
    >
      <div
        className="text-right pt-2 leading-[1.4]"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--ink-tertiary)",
        }}
      >
        <div style={{ fontSize: 11 }}>{vm.clockLabel}</div>
        <div style={{ fontSize: 10, opacity: 0.65, marginTop: 2 }}>
          {vm.offsetLabel}
        </div>
      </div>

      <div className="relative min-w-0">
        <span
          aria-hidden
          className="absolute -left-2.5 top-3 h-2 w-2 rounded-full"
          style={{ background: vm.lane.cssColor }}
        />
        <div
          className={cn(
            "rounded-[var(--radius-md)] px-3.5 py-2.5 transition-colors",
            "border border-[var(--hair)] hover:border-[var(--hair-strong)]",
          )}
          style={{
            background: "var(--s1)",
            color: "var(--ink)",
            ...(active && {
              borderColor: "var(--primary-focus)",
              boxShadow:
                "0 0 0 1px color-mix(in srgb, var(--primary-focus) 35%, transparent)",
            }),
          }}
        >
          <ActHeader vm={vm} />
          {vm.bodyText && (
            <div
              className="mt-1"
              style={{
                fontSize: 13.5,
                lineHeight: 1.5,
                color: "var(--ink)",
                letterSpacing: "-0.1px",
              }}
            >
              {vm.bodyText}
            </div>
          )}
          <ActMeta vm={vm} />
        </div>
      </div>
    </article>
  );
}
