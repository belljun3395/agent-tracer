import type { OpenInferenceSpanKind } from "~web/entities/task/model/openinference.js";
import type { GuidanceCatalog } from "~web/shared/guidance.js";
import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText, Tooltip } from "~web/shared/ui/index.js";

interface SpanKindChipProps {
  readonly kind: OpenInferenceSpanKind;
}

/** span kind 전용 색 팔레트(레인 색과는 별개). */
const KIND_TONE: Record<
  OpenInferenceSpanKind,
  { color: string; bg: string; label: string; guidanceKey: SpanKindDescription }
> = {
  LLM: {
    color: "var(--ph-plan)",
    bg: "color-mix(in srgb, var(--ph-plan) 14%, transparent)",
    label: "LLM",
    guidanceKey: "llm",
  },
  TOOL: {
    color: "var(--ph-impl)",
    bg: "color-mix(in srgb, var(--ph-impl) 14%, transparent)",
    label: "TOOL",
    guidanceKey: "tool",
  },
  AGENT: {
    color: "var(--ph-coord)",
    bg: "color-mix(in srgb, var(--ph-coord) 14%, transparent)",
    label: "AGENT",
    guidanceKey: "agent",
  },
  RETRIEVER: {
    color: "var(--ph-expl)",
    bg: "color-mix(in srgb, var(--ph-expl) 14%, transparent)",
    label: "FETCH",
    guidanceKey: "retriever",
  },
  CHAIN: {
    color: "var(--ink-muted)",
    bg: "var(--s2)",
    label: "STEP",
    guidanceKey: "chain",
  },
  UNKNOWN: {
    color: "var(--ink-tertiary)",
    bg: "var(--s2)",
    label: "MISC",
    guidanceKey: "unknown",
  },
};

export function SpanKindChip({ kind }: SpanKindChipProps) {
  const guidance = useGuidance();
  const tone = KIND_TONE[kind];
  return (
    <Tooltip
      content={
        <GuidanceText
          locale={guidance.locale}
          message={guidance.messages.inspector.spanKinds[tone.guidanceKey]}
        />
      }
      side="right"
    >
      <span
        className="inline-flex items-center rounded-xs px-1.5 font-mono text-[9.5px] font-semibold tracking-[0.08em] leading-4"
        style={{ color: tone.color, background: tone.bg }}
      >
        {tone.label}
      </span>
    </Tooltip>
  );
}

type SpanKindDescription = keyof GuidanceCatalog["inspector"]["spanKinds"];
