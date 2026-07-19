import type { TagSummaryRecord } from "~web/entities/tag/model/tag.js";
import { useDeleteTagMutation } from "~web/entities/tag/api/mutations.js";
import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText } from "~web/shared/ui/index.js";

interface TagDeleteConfirmProps {
  readonly tag: TagSummaryRecord;
  readonly onClose: () => void;
}

/** 태그 삭제가 몇 개의 태스크에서 태그를 떼어내는지 알리고 확인을 받는다. */
export function TagDeleteConfirm({ tag, onClose }: TagDeleteConfirmProps) {
  const guidance = useGuidance();
  const deleteMutation = useDeleteTagMutation();

  const handleDelete = () => {
    deleteMutation.mutate(tag.id, { onSuccess: onClose });
  };

  return (
    <div className="pt-4 px-4 pb-4 flex flex-col gap-3">
      <GuidanceText
        as="p"
        className="m-0 text-[12.5px] text-ink-subtle leading-[1.5]"
        locale={guidance.locale}
        message={guidance.messages.tags.deleteDescription}
      />
      <p className="m-0 text-[12.5px] text-ink">
        Deleting <strong>{tag.name}</strong> will detach it from {tag.taskCount} task
        {tag.taskCount === 1 ? "" : "s"}.
      </p>
      {deleteMutation.isError && (
        <p role="alert" className="m-0 text-xs text-err">
          Delete failed. Try again.
        </p>
      )}
      <footer className="flex justify-end gap-2 pt-2 border-t border-hair">
        <button
          type="button"
          onClick={onClose}
          disabled={deleteMutation.isPending}
          className="py-[7px] px-3 text-[12.5px] text-ink-muted bg-transparent border border-hair rounded-xs cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="py-[7px] px-3.5 text-[12.5px] font-medium text-canvas bg-err border border-err rounded-xs cursor-pointer disabled:opacity-50"
        >
          {deleteMutation.isPending ? "Deleting…" : "Delete tag"}
        </button>
      </footer>
    </div>
  );
}
