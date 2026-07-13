import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import { extractTags } from "~web/widgets/inspector/lib/extract-tags.js";

interface EventTagsProps {
  readonly event: TimelineEventRecord;
}

/** Inspect 섹션 하단의 칩 스트립. */
export function EventTags({ event }: EventTagsProps) {
  const tags = extractTags(event);
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {tags.map((tag, idx) => (
        <span
          key={`${tag.k}-${idx}`}
          className="inline-flex items-center rounded-xs px-1.5 py-0.5 font-mono text-[10px] text-ink-muted bg-s2 border border-hair tracking-normal"
        >
          <span className="text-ink-tertiary mr-[3px]">
            {tag.k}
          </span>
          {tag.v}
        </span>
      ))}
    </div>
  );
}
