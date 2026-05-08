import type { TimelineEventRecord } from "~domain/monitoring.js";

export interface Tag {
  readonly k: string;
  readonly v: string;
}

/**
 * Surface label-like metadata for the chip strip at the bottom of the
 * Inspect tab. Two sources combined in priority order:
 *
 *   1. Hand-curated keys from `event.metadata` — env / issue / area / author
 *      (these are the ones the v6 mock shows; if the backend adds more,
 *      register them here with intent).
 *   2. Classification tags from `event.classification.tags` (lane hints,
 *      "violation", etc.) — flattened with key "tag" so they're scannable.
 *
 * Returns an empty list when neither source has anything; the UI then
 * collapses the chip strip entirely.
 */
const META_TAG_KEYS: readonly string[] = ["env", "issue", "area", "author"];

export function extractTags(event: TimelineEventRecord): readonly Tag[] {
  const out: Tag[] = [];
  const meta = event.metadata;

  for (const key of META_TAG_KEYS) {
    const v = meta[key];
    if (typeof v === "string" && v.length > 0) {
      out.push({ k: key, v });
    }
  }

  for (const tag of event.classification.tags) {
    out.push({ k: "tag", v: tag });
  }

  return out;
}
