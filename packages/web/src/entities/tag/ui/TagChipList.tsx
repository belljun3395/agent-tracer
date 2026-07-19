import type { ReactNode } from "react";
import type { TagRecord } from "~web/entities/tag/model/tag.js";
import { TagChip } from "~web/entities/tag/ui/TagChip.js";

interface TagChipListProps {
  readonly tags: readonly Pick<TagRecord, "id" | "name" | "color">[];
  /** 이 개수를 넘는 태그는 "+N" 배지로 접힌다. */
  readonly maxVisible?: number;
  readonly emptyFallback?: ReactNode;
}

/** 태스크 헤더와 목록 행이 함께 쓰는 태그 칩 한 줄이다. */
export function TagChipList({ tags, maxVisible = 4, emptyFallback = null }: TagChipListProps) {
  if (tags.length === 0) return <>{emptyFallback}</>;

  const visible = tags.slice(0, maxVisible);
  const overflowCount = tags.length - visible.length;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map((tag) => (
        <TagChip key={tag.id} tag={tag} />
      ))}
      {overflowCount > 0 && (
        <span className="font-mono text-[10.5px] text-ink-tertiary" title={`${overflowCount} more tags`}>
          +{overflowCount}
        </span>
      )}
    </div>
  );
}
