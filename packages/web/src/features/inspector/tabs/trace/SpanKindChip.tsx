import type { OpenInferenceSpanKind } from "~domain/openinference.js";

interface SpanKindChipProps {
  readonly kind: OpenInferenceSpanKind;
}

/**
 * Color palette dedicated to span kinds (orthogonal to lane colors).
 * OpenInference uses six standardised kinds — the chip lets the operator
 * scan a flat span list and group by intent without re-reading attributes.
 */
const KIND_TONE: Record<OpenInferenceSpanKind, { color: string; bg: string }> = {
  LLM: {
    color: "var(--ph-plan)",
    bg: "color-mix(in srgb, var(--ph-plan) 14%, transparent)",
  },
  TOOL: {
    color: "var(--ph-impl)",
    bg: "color-mix(in srgb, var(--ph-impl) 14%, transparent)",
  },
  AGENT: {
    color: "var(--ph-coord)",
    bg: "color-mix(in srgb, var(--ph-coord) 14%, transparent)",
  },
  RETRIEVER: {
    color: "var(--ph-expl)",
    bg: "color-mix(in srgb, var(--ph-expl) 14%, transparent)",
  },
  CHAIN: {
    color: "var(--ink-muted)",
    bg: "var(--s2)",
  },
  UNKNOWN: {
    color: "var(--ink-tertiary)",
    bg: "var(--s2)",
  },
};

export function SpanKindChip({ kind }: SpanKindChipProps) {
  const tone = KIND_TONE[kind];
  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-xs)] px-1.5"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: "0.08em",
        color: tone.color,
        background: tone.bg,
        lineHeight: "16px",
      }}
    >
      {kind}
    </span>
  );
}
