import type { OpenInferenceSpanKind } from "~domain/openinference.js";
import { Tooltip } from "~ui/index.js";

interface SpanKindChipProps {
  readonly kind: OpenInferenceSpanKind;
}

/**
 * Color palette dedicated to span kinds (orthogonal to lane colors).
 * OpenInference uses six standardised kinds — the chip lets the operator
 * scan a flat span list and group by intent without re-reading attributes.
 *
 * Each kind also carries a one-line explanation surfaced via the chip's
 * hover tooltip — the audit flagged "what does CHAIN mean?" /
 * "what does UNKNOWN mean?" as a recurring blocker for operators not
 * familiar with the OpenInference vocabulary.
 */
const KIND_TONE: Record<
  OpenInferenceSpanKind,
  { color: string; bg: string; label: string; description: string }
> = {
  LLM: {
    color: "var(--ph-plan)",
    bg: "color-mix(in srgb, var(--ph-plan) 14%, transparent)",
    label: "LLM",
    description: "Model call — a prompt was sent to the language model",
  },
  TOOL: {
    color: "var(--ph-impl)",
    bg: "color-mix(in srgb, var(--ph-impl) 14%, transparent)",
    label: "TOOL",
    description: "Tool invocation — the agent ran a tool like Bash or Edit",
  },
  AGENT: {
    color: "var(--ph-coord)",
    bg: "color-mix(in srgb, var(--ph-coord) 14%, transparent)",
    label: "AGENT",
    description:
      "Subagent delegation — work handed off to a specialised sub-agent",
  },
  RETRIEVER: {
    color: "var(--ph-expl)",
    bg: "color-mix(in srgb, var(--ph-expl) 14%, transparent)",
    label: "FETCH",
    description: "Retrieval — the agent queried a document or memory store",
  },
  CHAIN: {
    color: "var(--ink-muted)",
    bg: "var(--s2)",
    label: "STEP",
    description:
      "Workflow step — a parent span that groups one or more child spans",
  },
  UNKNOWN: {
    color: "var(--ink-tertiary)",
    bg: "var(--s2)",
    label: "MISC",
    description:
      "Misc event — context snapshot, notification, or other telemetry",
  },
};

export function SpanKindChip({ kind }: SpanKindChipProps) {
  const tone = KIND_TONE[kind];
  return (
    <Tooltip content={tone.description} side="right">
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
        {tone.label}
      </span>
    </Tooltip>
  );
}
