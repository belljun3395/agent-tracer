import type { TagSummaryRecord } from "~web/entities/tag/model/tag.js";
import { TagChip } from "~web/entities/tag/ui/TagChip.js";
import { Button } from "~web/shared/ui/index.js";

interface TagManagerListItemProps {
  readonly tag: TagSummaryRecord;
  readonly onEdit: (tag: TagSummaryRecord) => void;
  readonly onDelete: (tag: TagSummaryRecord) => void;
  readonly onViewTasks: (tag: TagSummaryRecord) => void;
}

/** 태그 관리 목록의 행 하나이며 색 견본과 설명과 태스크 개수와 편집 액션을 보여준다. */
export function TagManagerListItem({ tag, onEdit, onDelete, onViewTasks }: TagManagerListItemProps) {
  return (
    <article className="bg-s1 border border-hair rounded-md py-3 px-3.5 flex flex-col gap-2">
      <div className="flex items-center gap-2.5 flex-wrap">
        <TagChip tag={tag} />
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => onViewTasks(tag)}
          className="font-mono text-[10.5px] text-ink-muted underline decoration-dotted underline-offset-2 hover:text-ink"
        >
          {tag.taskCount} task{tag.taskCount === 1 ? "" : "s"}
        </button>
      </div>

      {tag.description && (
        <p className="m-0 text-xs text-ink-subtle leading-[1.5]">{tag.description}</p>
      )}

      <div className="flex items-center gap-2 mt-1">
        <Button variant="ghost" onClick={() => onEdit(tag)}>
          Edit
        </Button>
        <span className="flex-1" />
        <Button variant="ghost" onClick={() => onDelete(tag)} className="text-ink-muted border-hair">
          Delete
        </Button>
      </div>
    </article>
  );
}
