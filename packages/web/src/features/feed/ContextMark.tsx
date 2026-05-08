interface ContextMarkProps {
  readonly percent: number;
  readonly model: string | null;
  readonly modelChanged: boolean;
  readonly deltaPct: number;
}

/**
 * Inline divider showing the context-window state at this point in the
 * timeline. Emitted between ActCards by `buildFeed` whenever a
 * `context.snapshot` event reports either a meaningful context shift
 * (≥5 pp from the last mark) or a model change.
 *
 * Keeps the same dashed-hairline silhouette as TimeMark / TurnMark so
 * the feed scans as a single rhythmic stack of separators, with the
 * card lanes interleaved between.
 */
export function ContextMark({
  percent,
  model,
  modelChanged,
  deltaPct,
}: ContextMarkProps) {
  const tone =
    percent >= 95 ? "err" : percent >= 85 ? "warn" : "neutral";
  const toneColor =
    tone === "err"
      ? "var(--err)"
      : tone === "warn"
        ? "var(--warn)"
        : "var(--ink-tertiary)";
  const deltaLabel =
    Math.abs(deltaPct) >= 0.5
      ? `${deltaPct >= 0 ? "+" : "−"}${Math.abs(Math.round(deltaPct))}%`
      : null;

  return (
    <div
      className="flex items-center gap-2.5 py-2.5"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        color: toneColor,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      <Hairline color={toneColor} />
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "2px 9px",
          background: "var(--canvas)",
          border: `1px solid color-mix(in srgb, ${toneColor} 35%, transparent)`,
          borderRadius: 999,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: toneColor, fontWeight: 600 }}>
          Context {Math.round(percent)}%
        </span>
        {deltaLabel && (
          <span style={{ color: "var(--ink-tertiary)", fontWeight: 400 }}>
            {deltaLabel}
          </span>
        )}
        {model && (
          <>
            <span style={{ color: "var(--ink-tertiary)" }}>·</span>
            <span
              style={{
                color: modelChanged ? "var(--primary)" : "var(--ink-muted)",
                fontWeight: modelChanged ? 600 : 400,
              }}
            >
              {model}
            </span>
          </>
        )}
      </span>
      <Hairline color={toneColor} />
    </div>
  );
}

function Hairline({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="flex-1"
      style={{
        borderTop: `1px dashed color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    />
  );
}
