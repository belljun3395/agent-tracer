import type { TagSummaryRecord } from "~web/entities/tag/model/tag.js";
import { TagManagerListItem } from "~web/widgets/tags/TagManagerListItem.js";

interface TagManagerListProps {
  readonly tags: readonly TagSummaryRecord[];
  readonly onEdit: (tag: TagSummaryRecord) => void;
  readonly onDelete: (tag: TagSummaryRecord) => void;
  readonly onViewTasks: (tag: TagSummaryRecord) => void;
}

/** 워크스페이스 태그 전체를 관리 행으로 나열한다. */
export function TagManagerList({ tags, onEdit, onDelete, onViewTasks }: TagManagerListProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {tags.map((tag) => (
        <TagManagerListItem
          key={tag.id}
          tag={tag}
          onEdit={onEdit}
          onDelete={onDelete}
          onViewTasks={onViewTasks}
        />
      ))}
    </div>
  );
}
