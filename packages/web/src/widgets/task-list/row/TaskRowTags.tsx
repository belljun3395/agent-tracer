import type { TaskId } from "~web/shared/identity.js";
import { useTaskTagsQuery } from "~web/entities/tag/api/queries.js";
import { TagChipList } from "~web/entities/tag/ui/TagChipList.js";

interface TaskRowTagsProps {
  readonly taskId: TaskId;
}

/** 태스크 목록 행에 붙은 태그 칩을 그리며 태그가 없으면 아무것도 그리지 않는다. */
export function TaskRowTags({ taskId }: TaskRowTagsProps) {
  const { data } = useTaskTagsQuery(taskId);
  const tags = data?.tags ?? [];
  if (tags.length === 0) return null;

  return (
    <div className="mt-1">
      <TagChipList tags={tags} maxVisible={3} />
    </div>
  );
}
