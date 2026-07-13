interface ContextMarkProps {
  readonly percent: number;
  readonly model: string | null;
  readonly modelChanged: boolean;
  readonly deltaPct: number;
}

/** 타임라인 이 지점에서 컨텍스트 윈도우 상태를 보여주는 인라인 구분선. */
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
      className="flex items-center gap-2.5 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.04em]"
      style={{ color: toneColor }}
    >
      <Hairline color={toneColor} />
      <span
        className="inline-flex items-center gap-2 py-0.5 px-2.5 bg-canvas rounded-full whitespace-nowrap"
        style={{ border: `1px solid color-mix(in srgb, ${toneColor} 35%, transparent)` }}
      >
        <span className="font-semibold" style={{ color: toneColor }}>
          Context {Math.round(percent)}%
        </span>
        {deltaLabel && (
          <span className="font-normal text-ink-tertiary">
            {deltaLabel}
          </span>
        )}
        {model && (
          <>
            <span className="text-ink-tertiary">·</span>
            <span
              className={modelChanged ? "font-semibold text-primary" : "font-normal text-ink-muted"}
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
