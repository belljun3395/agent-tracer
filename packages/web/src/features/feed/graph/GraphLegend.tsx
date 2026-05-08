/**
 * Bottom legend strip explaining the graph's visual vocabulary. Renders
 * once, below the axis.
 */
export function GraphLegend() {
  return (
    <div
      className="flex items-center gap-3.5 px-4 py-2.5 border-t border-[var(--hair)] flex-wrap"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        color: "var(--ink-tertiary)",
        background: "var(--canvas)",
      }}
    >
      <Item color="var(--ph-plan)">
        <Swatch color="var(--ph-plan)" />
        Lane node
      </Item>
      <Item color="var(--err)">
        <Swatch color="var(--err)" />
        Rule violation
      </Item>
      <Item color="var(--ink-tertiary)">
        <Line dashed={false} color="var(--ink-tertiary)" />
        Causal edge
      </Item>
      <Item color="var(--ink-tertiary)">
        <Line dashed={true} color="var(--ink-tertiary)" />
        Explicit parent
      </Item>
      <Item color="var(--warn)">
        <span
          aria-hidden
          className="h-2.5 w-2.5 rounded-sm border-2"
          style={{ borderColor: "var(--warn)", borderStyle: "dashed" }}
        />
        PreCompact
      </Item>
      <Item color="var(--ink)">
        <span
          aria-hidden
          className="inline-block"
          style={{ width: 1, height: 12, background: "var(--ink)" }}
        />
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
