import type { ModelSpan } from "~web/widgets/feed/lib/extraction/extract-model-spans.js";
import { msToLeftPercent, type TimeRange } from "~web/widgets/feed/graph/model/time-range.js";
import {
  MODEL_BAND_HEIGHT,
  dedupeModelLabels,
  modelFamilyColor,
} from "~web/widgets/feed/graph/context/presentation.js";

interface ModelSpanBandProps {
  readonly spans: readonly ModelSpan[];
  readonly range: TimeRange;
}

/** 시간축에 정렬된 모델 계열 구간과 전환 순서를 표시한다. */
export function ModelSpanBand({ spans, range }: ModelSpanBandProps) {
  if (spans.length === 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: MODEL_BAND_HEIGHT,
        display: "flex",
        alignItems: "center",
      }}
    >
      {spans.map((span, index) => {
        const startPercent = msToLeftPercent(span.startMs, range);
        const endPercent = msToLeftPercent(span.endMs, range);
        return (
          <div
            key={`${span.modelId}-${index}`}
            title={span.modelId}
            style={{
              position: "absolute",
              left: `${startPercent}%`,
              width: `${Math.max(0.5, endPercent - startPercent)}%`,
              height: 8,
              background: modelFamilyColor(span.label),
              opacity: 0.55,
              borderRadius: 2,
            }}
          />
        );
      })}
      <div className="relative ml-auto pr-2 font-mono text-[9.5px] text-ink-tertiary pointer-events-none whitespace-nowrap">
        {dedupeModelLabels(spans).join(" → ")}
      </div>
    </div>
  );
}
