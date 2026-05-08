import type { TimelineEventRecord } from "~domain/monitoring.js";
import { extractTags } from "~features/inspector/lib/extract-tags.js";

interface EventTagsProps {
  readonly event: TimelineEventRecord;
}

/**
 * Chip strip at the bottom of the Inspect section. Each chip pairs a small
 * tertiary key with a muted value. Hidden when there's nothing to show.
 */
export function EventTags({ event }: EventTagsProps) {
  const tags = extractTags(event);
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {tags.map((tag, idx) => (
        <span
          key={`${tag.k}-${idx}`}
          className="inline-flex items-center rounded-[var(--radius-xs)] px-1.5"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--ink-muted)",
            background: "var(--s2)",
            border: "1px solid var(--hair)",
            letterSpacing: 0,
            paddingTop: 2,
            paddingBottom: 2,
          }}
        >
          <span
            style={{ color: "var(--ink-tertiary)", marginRight: 3 }}
          >
            {tag.k}
          </span>
          {tag.v}
        </span>
      ))}
    </div>
  );
}
