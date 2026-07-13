import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";

export interface Tag {
  readonly k: string;
  readonly v: string;
}

/** Inspect 탭 하단 칩 스트립을 위해 라벨 형태의 메타데이터를 뽑는다. */
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
