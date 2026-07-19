import { useEffect, useMemo, useRef, useState } from "react";
import type { TagId, TaskId } from "~web/shared/identity.js";
import type { TagSummaryRecord } from "~web/entities/tag/model/tag.js";
import { useTagsQuery, useTaskTagsQuery } from "~web/entities/tag/api/queries.js";
import {
  useCreateTagMutation,
  useSetTaskTagsMutation,
} from "~web/entities/tag/api/mutations.js";
import { useGuidance } from "~web/shared/store/index.js";
import { AnchoredPopover, GuidanceText, Input } from "~web/shared/ui/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";

interface TaskTagPickerProps {
  readonly taskId: TaskId;
}

/** GitHub 라벨 드롭다운처럼 태스크의 태그 집합을 고르고 그 자리에서 새 태그도 만든다. */
export function TaskTagPicker({ taskId }: TaskTagPickerProps) {
  const guidance = useGuidance();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const tagsQ = useTagsQuery();
  const taskTagsQ = useTaskTagsQuery(taskId, { enabled: open });
  const setTagsMutation = useSetTaskTagsMutation();
  const createMutation = useCreateTagMutation();

  const currentTagIds = useMemo(
    () => new Set((taskTagsQ.data?.tags ?? []).map((tag) => tag.id)),
    [taskTagsQ.data],
  );

  const allTags = tagsQ.data?.tags ?? [];
  const trimmedQuery = query.trim();
  const visibleTags = useMemo(() => {
    if (!trimmedQuery) return allTags;
    const needle = trimmedQuery.toLowerCase();
    return allTags.filter((tag) => tag.name.toLowerCase().includes(needle));
  }, [allTags, trimmedQuery]);

  const hasExactMatch = allTags.some(
    (tag) => tag.name.toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const canCreate = trimmedQuery.length > 0 && !hasExactMatch;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggleTag = (tagId: TagId) => {
    const next = new Set(currentTagIds);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    setTagsMutation.mutate({ taskId, tagIds: Array.from(next) });
  };

  const createAndAttach = () => {
    const name = trimmedQuery;
    if (!name) return;
    createMutation.mutate(
      { name },
      {
        onSuccess: (response) => {
          setQuery("");
          setTagsMutation.mutate({
            taskId,
            tagIds: [...Array.from(currentTagIds), response.tag.id],
          });
        },
      },
    );
  };

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Edit tags"
        className="inline-flex items-center gap-1 rounded-xs border border-dashed border-hair-strong px-1.5 py-0.5 text-[10.5px] font-medium text-ink-subtle hover:text-ink hover:border-hair-strong"
      >
        + Tag
      </button>

      {open && (
        <AnchoredPopover
          ref={popoverRef}
          anchorRef={anchorRef}
          role="dialog"
          aria-label="Task tags"
          preferredWidth={280}
          preferredMaxHeight={360}
          gap={4}
          className="rounded-xs border border-hair bg-canvas shadow-lg"
        >
          <div className="p-2 border-b border-hair flex flex-col gap-1">
            <GuidanceText
              as="p"
              className="m-0 text-[10.5px] text-ink-tertiary"
              locale={guidance.locale}
              message={guidance.messages.tags.taskAssignDescription}
            />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter or create a tag…"
              className="w-full text-[12px] py-1"
            />
          </div>
          <div role="listbox" aria-label="Workspace tags" className="max-h-[240px] overflow-y-auto py-1">
            {visibleTags.map((tag) => (
              <TagOptionRow
                key={tag.id}
                tag={tag}
                checked={currentTagIds.has(tag.id)}
                onToggle={() => toggleTag(tag.id)}
              />
            ))}
            {allTags.length === 0 && !canCreate && (
              <p className="px-3 py-4 text-center text-[11.5px] text-ink-tertiary">
                No tags yet.
              </p>
            )}
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={createAndAttach}
              disabled={createMutation.isPending}
              className="w-full px-3 py-2 text-left text-[12px] text-primary-hover border-t border-hair hover:bg-s1"
            >
              {createMutation.isPending ? "Creating…" : `Create tag "${trimmedQuery}"`}
            </button>
          )}
        </AnchoredPopover>
      )}
    </div>
  );
}

function TagOptionRow({
  tag,
  checked,
  onToggle,
}: {
  readonly tag: TagSummaryRecord;
  readonly checked: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={checked}
      onClick={onToggle}
      className={cn("w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-s1", checked && "bg-s1")}
    >
      <span aria-hidden className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
      <span className="flex-1 truncate text-[12.5px] text-ink">{tag.name}</span>
      {checked && (
        <span aria-hidden className="text-primary text-[11px]">
          ✓
        </span>
      )}
    </button>
  );
}
