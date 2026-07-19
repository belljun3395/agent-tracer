import { useState } from "react";
import {
  TAG_COLOR_PATTERN,
  TAG_DEFAULT_COLOR,
  TAG_DESCRIPTION_MAX_LENGTH,
  TAG_NAME_MAX_LENGTH,
} from "@monitor/kernel";
import type { TagRecord } from "~web/entities/tag/model/tag.js";
import {
  useCreateTagMutation,
  useUpdateTagMutation,
} from "~web/entities/tag/api/mutations.js";
import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText, Input } from "~web/shared/ui/index.js";
import { TagColorPicker } from "~web/widgets/tags/TagColorPicker.js";

interface TagEditorFormProps {
  readonly tag?: TagRecord;
  readonly onClose: () => void;
}

/** 태그 생성과 수정이 함께 쓰는 폼이다. */
export function TagEditorForm({ tag, onClose }: TagEditorFormProps) {
  const guidance = useGuidance();
  const isEdit = Boolean(tag);
  const [name, setName] = useState(tag?.name ?? "");
  const [color, setColor] = useState(tag?.color ?? TAG_DEFAULT_COLOR);
  const [description, setDescription] = useState(tag?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateTagMutation();
  const updateMutation = useUpdateTagMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (event: { readonly preventDefault: () => void }) => {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    if (!TAG_COLOR_PATTERN.test(color)) {
      setError("Color must be #rrggbb.");
      return;
    }

    const trimmedDescription = description.trim();
    const onError = (mutationError: unknown) =>
      setError(mutationError instanceof Error ? mutationError.message : "Save failed.");

    if (isEdit && tag) {
      updateMutation.mutate(
        { tagId: tag.id, body: { name: trimmedName, color, description: trimmedDescription || null } },
        { onSuccess: onClose, onError },
      );
      return;
    }

    createMutation.mutate(
      { name: trimmedName, color, ...(trimmedDescription ? { description: trimmedDescription } : {}) },
      { onSuccess: onClose, onError },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="pt-4 px-4 pb-0 flex flex-col gap-3.5">
      <GuidanceText
        as="p"
        className="m-0 text-[11.5px] text-ink-tertiary"
        locale={guidance.locale}
        message={isEdit ? guidance.messages.tags.editDescription : guidance.messages.tags.createDescription}
      />

      <div className="flex flex-col gap-1.5 py-3.5 border-t border-hair">
        <label className="text-[12.5px] font-medium text-ink tracking-[-0.01em]">Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={TAG_NAME_MAX_LENGTH}
          disabled={isPending}
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-1.5 py-3.5 border-t border-hair">
        <label className="text-[12.5px] font-medium text-ink tracking-[-0.01em]">Color</label>
        <TagColorPicker color={color} onChange={setColor} disabled={isPending} />
      </div>

      <div className="flex flex-col gap-1.5 py-3.5 border-t border-hair">
        <label className="text-[12.5px] font-medium text-ink tracking-[-0.01em]">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={TAG_DESCRIPTION_MAX_LENGTH}
          rows={2}
          disabled={isPending}
          className="px-2.5 py-1.5 text-sm rounded-xs border border-hair bg-canvas text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
        />
      </div>

      {error && (
        <div role="alert" className="m-0 text-xs text-err leading-[1.5]">
          {error}
        </div>
      )}

      <footer className="sticky bottom-0 -mx-4 mt-1 py-3 px-4 flex justify-end gap-2 bg-s1 border-t border-hair">
        <button type="button" onClick={onClose} disabled={isPending} className={ghostButtonClassName}>
          Cancel
        </button>
        <button type="submit" disabled={isPending} className={primaryButtonClassName}>
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Create tag"}
        </button>
      </footer>
    </form>
  );
}

const primaryButtonClassName =
  "py-[7px] px-3.5 text-[12.5px] font-medium text-canvas bg-primary border border-primary rounded-xs cursor-pointer";

const ghostButtonClassName =
  "py-[7px] px-3 text-[12.5px] text-ink-muted bg-transparent border border-hair rounded-xs cursor-pointer";
