import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";

export interface ModelSpan {
  /** 계열명으로 축약한 라벨. 예: "Opus", "Sonnet". */
  readonly label: string;
  /** 메타데이터에 있던 원본 모델 id. 렌더러가 툴팁에 전체 식별자를
   * 보여주고 싶을 때 쓴다. */
  readonly modelId: string;
  /** 구간 시작 시각(ms). 이 모델이 처음 나타난 샘플 시각. */
  readonly startMs: number;
  /** 구간 끝 시각(ms). 다음 구간의 시작이거나 가장 최근 이벤트 시각. */
  readonly endMs: number;
}

/** 메타데이터에 `modelId`가 있는 타임라인 이벤트를 순회하며 같은 계열 라벨의 연속 구간을 하나로 합친다. */
export function buildModelSpans(
  events: readonly TimelineEventRecord[],
): readonly ModelSpan[] {
  const samples: Array<{ ms: number; modelId: string; label: string }> = [];
  let lastMs = 0;
  for (const event of events) {
    const ms = Date.parse(event.createdAt);
    if (ms > lastMs) lastMs = ms;
    const modelId = readModelId(event.metadata);
    if (!modelId) continue;
    samples.push({ ms, modelId, label: shortenModelId(modelId) });
  }
  samples.sort((a, b) => a.ms - b.ms);
  if (samples.length === 0) return [];

  const spans: ModelSpan[] = [];
  for (const sample of samples) {
    const tail = spans[spans.length - 1];
    if (tail && tail.label === sample.label) {
      // 같은 계열이면 마지막 구간의 끝을 이 시각까지 늘린다.
      spans[spans.length - 1] = {
        ...tail,
        endMs: sample.ms,
      };
      continue;
    }
    spans.push({
      label: sample.label,
      modelId: sample.modelId,
      startMs: sample.ms,
      endMs: sample.ms,
    });
  }
  // 마지막 구간을 가장 최근 이벤트까지 늘려, 띠가 "지금까지 쓰인
  // 모델"을 시각적으로 표현하게 한다.
  if (spans.length > 0) {
    const last = spans[spans.length - 1]!;
    if (lastMs > last.endMs) {
      spans[spans.length - 1] = { ...last, endMs: lastMs };
    }
  }
  return spans;
}

const MODEL_KEYS = ["modelId", "model_id", "model"] as const;

function readModelId(meta: Record<string, unknown>): string | null {
  for (const key of MODEL_KEYS) {
    const v = meta[key];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return null;
}

function shortenModelId(modelId: string): string {
  const lower = modelId.toLowerCase();
  if (lower.includes("opus")) return "Opus";
  if (lower.includes("sonnet")) return "Sonnet";
  if (lower.includes("haiku")) return "Haiku";
  // 최후 수단으로 대시로 나눈 조각 중 글자가 있는 첫 조각을 쓴다.
  const segment = modelId.split(/[-/_]/).find((s) => /[a-zA-Z]/.test(s));
  return segment ?? modelId.slice(0, 12);
}
