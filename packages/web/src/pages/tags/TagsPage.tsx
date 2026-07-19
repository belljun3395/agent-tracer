import { useState } from "react";
import type { TagSummaryRecord } from "~web/entities/tag/model/tag.js";
import { useTagsQuery } from "~web/entities/tag/api/queries.js";
import { useGuidance } from "~web/shared/store/index.js";
import { Button, GuidanceText, Modal } from "~web/shared/ui/index.js";
import { TagManagerList } from "~web/widgets/tags/TagManagerList.js";
import { TagEditorForm } from "~web/widgets/tags/TagEditorForm.js";
import { TagDeleteConfirm } from "~web/widgets/tags/TagDeleteConfirm.js";
import { TaggedTaskList } from "~web/widgets/tags/TaggedTaskList.js";

type EditorState = "closed" | "create" | TagSummaryRecord;

/** `/tags`. 워크스페이스 전체 태그 관리 화면이다. */
export function TagsPage() {
  const guidance = useGuidance();
  const { data, isLoading, isError } = useTagsQuery();
  const [editorState, setEditorState] = useState<EditorState>("closed");
  const [deletingTag, setDeletingTag] = useState<TagSummaryRecord | null>(null);
  const [viewingTag, setViewingTag] = useState<TagSummaryRecord | null>(null);

  const tags = data?.tags ?? [];

  return (
    <div className="flex flex-col min-h-0 h-full overflow-auto">
      <header className="px-9 pt-6 pb-4 flex flex-col gap-3 border-b border-hair">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="m-0 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-tertiary">
              Workspace
            </p>
            <h1 className="mt-0.5 mb-0 text-[22px] font-semibold text-ink tracking-[-0.3px]">
              Tags
            </h1>
            <GuidanceText
              as="p"
              className="mt-1 mb-0 text-[12.5px] text-ink-subtle"
              locale={guidance.locale}
              message={guidance.messages.tags.workspaceIntroduction}
            />
            <p className="mt-1 mb-0 text-[12.5px] text-ink-subtle">
              {isLoading
                ? "Loading…"
                : data
                  ? `${tags.length} tag${tags.length === 1 ? "" : "s"}`
                  : "Couldn't load tags."}
            </p>
          </div>
          <Button variant="primary" onClick={() => setEditorState("create")}>
            New tag
          </Button>
        </div>
      </header>

      <div className="px-9 py-6 flex flex-col gap-2.5">
        {isError && (
          <div className="text-err text-[12.5px]">
            <p className="m-0">Couldn't load tags.</p>
            <GuidanceText
              as="p"
              className="mt-1 mb-0"
              locale={guidance.locale}
              message={guidance.messages.tags.loadError}
            />
          </div>
        )}
        {!isLoading && tags.length === 0 && !isError && (
          <GuidanceText
            as="p"
            className="text-[12.5px] text-ink-subtle text-center py-8"
            locale={guidance.locale}
            message={guidance.messages.tags.workspaceEmpty}
          />
        )}
        <TagManagerList
          tags={tags}
          onEdit={setEditorState}
          onDelete={setDeletingTag}
          onViewTasks={setViewingTag}
        />
      </div>

      <Modal
        open={editorState !== "closed"}
        onClose={() => setEditorState("closed")}
        title={editorState === "create" ? "New tag" : "Edit tag"}
      >
        {editorState !== "closed" && (
          <TagEditorForm
            {...(editorState !== "create" ? { tag: editorState } : {})}
            onClose={() => setEditorState("closed")}
          />
        )}
      </Modal>

      <Modal
        open={deletingTag !== null}
        onClose={() => setDeletingTag(null)}
        title="Delete tag"
      >
        {deletingTag && (
          <TagDeleteConfirm tag={deletingTag} onClose={() => setDeletingTag(null)} />
        )}
      </Modal>

      <Modal
        open={viewingTag !== null}
        onClose={() => setViewingTag(null)}
        title={viewingTag ? `Tasks tagged "${viewingTag.name}"` : "Tagged tasks"}
      >
        {viewingTag && <TaggedTaskList tagId={viewingTag.id} />}
      </Modal>
    </div>
  );
}
