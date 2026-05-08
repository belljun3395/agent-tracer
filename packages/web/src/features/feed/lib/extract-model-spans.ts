import type { TimelineEventRecord } from "~domain/monitoring.js";

export interface ModelSpan {
  /** Trimmed-to-family label, e.g. "Opus", "Sonnet", "GPT-4o", "Codex". */
  readonly label: string;
  /** Original model id from metadata, in case the renderer wants the
   * full identifier in a tooltip. */
  readonly modelId: string;
  /** Span start in ms (first sample carrying this model). */
  readonly startMs: number;
  /** Span end in ms — the next span's start, or the latest event time. */
  readonly endMs: number;
}

/**
 * Walk timeline events that carry a `modelId` in metadata and merge
 * consecutive ones with the same family label into spans. The label
 * is normalised so `claude-opus-4-7` and `claude-opus-4-5` both
 * collapse to "Opus" — a long task that bounces between minor
 * versions reads as one band, not a flickering stripe.
 *
 * Returns spans in chronological order. Each span's `endMs` is the
 * next span's `startMs`, or the timestamp of the very last event in
 * the timeline (so the right edge of the strip never hangs).
 */
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
      // Same family — extend the tail's end forward in time.
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
  // Stretch the final span to the latest event we saw, so the band
  // visually covers "model used through right now".
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
  if (lower.includes("gpt-4o")) return "GPT-4o";
  if (lower.includes("gpt-4")) return "GPT-4";
  if (lower.includes("gpt-5")) return "GPT-5";
  if (lower.includes("codex")) return "Codex";
  if (lower.includes("o1")) return "o1";
  if (lower.includes("o3")) return "o3";
  // Last-resort: take the first dash-segment with letters.
  const segment = modelId.split(/[-/_]/).find((s) => /[a-zA-Z]/.test(s));
  return segment ?? modelId.slice(0, 12);
}
