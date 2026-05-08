import type { AxisTick } from "./lib/ticks.js";
import { AXIS_HEIGHT } from "./lib/layout.js";

interface GraphAxisProps {
  readonly ticks: readonly AxisTick[];
  /** Pixel width of the graph's left lane-label column. */
  readonly leftOffset: number;
}

/**
 * Bottom time axis. Ticks come pre-projected as 0..100 percent values
 * relative to the playing field (excluding the lane-label gutter on the
 * left); we offset that gutter here so the visual aligns with nodes.
 */
export function GraphAxis({ ticks, leftOffset }: GraphAxisProps) {
  return (
    <div
      className="relative border-t border-[var(--hair)]"
      style={{
        height: AXIS_HEIGHT,
        background: "var(--canvas)",
      }}
    >
      <div
        className="absolute"
        style={{ left: leftOffset, right: 0, top: 0, bottom: 0 }}
      >
        {ticks.map((tick, idx) => (
          <span
            key={idx}
            className="absolute -translate-x-1/2"
            style={{
              left: `${tick.leftPercent}%`,
              top: 0,
              paddingTop: 9,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: tick.major ? "var(--ink-muted)" : "var(--ink-tertiary)",
              fontWeight: tick.major ? 500 : 400,
              whiteSpace: "nowrap",
            }}
          >
            <span
              aria-hidden
              className="absolute left-1/2 -translate-x-1/2"
              style={{
                top: 0,
                width: 1,
                height: tick.major ? 8 : 5,
                background: tick.major
                  ? "var(--ink-subtle)"
                  : "var(--ink-tertiary)",
              }}
            />
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  );
}
