/** 그래프의 시각적 어휘를 설명하는 하단 범례 스트립. */
export function GraphLegend() {
  return (
    <div className="flex items-center gap-3.5 px-4 py-2.5 border-t border-hair flex-wrap font-mono text-[10.5px] text-ink-tertiary bg-canvas">
      <Item color="var(--ph-plan)">
        <Swatch color="var(--ph-plan)" />
        Lane node
      </Item>
      <Item color="var(--err)">
        <Swatch color="var(--err)" />
        Rule violation
      </Item>
      <Item color="var(--ink-muted)">
        <Line dashed={false} color="var(--ink-muted)" />
        Explicit parent
      </Item>
      <Item color="var(--ink-tertiary)">
        <Line dashed={true} color="var(--ink-tertiary)" />
        Cross-lane causal
      </Item>
      <Item color="var(--warn)">
        <span
          aria-hidden
          className="h-2.5 w-2.5 rounded-[2px] border-2 border-dashed border-warn"
        />
        PreCompact
      </Item>
      <Item color="var(--ink)">
        <span aria-hidden className="inline-block w-px h-3 bg-ink" />
        NOW marker
      </Item>
    </div>
  );
}

function Item({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{ color }}
    >
      {children}
    </span>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="h-2.5 w-2.5 rounded-full"
      style={{ background: color }}
    />
  );
}

function Line({ color, dashed }: { color: string; dashed: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-block"
      style={{
        width: 18,
        height: 0,
        borderTop: `1.4px ${dashed ? "dashed" : "solid"} ${color}`,
      }}
    />
  );
}
