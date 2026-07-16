import { useMemo, useState } from "react";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import type { TaskId } from "~web/shared/identity.js";
import { useMemosQuery } from "~web/entities/memo/api/queries.js";
import { useTasksQuery } from "~web/entities/task/api/list-queries.js";
import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText } from "~web/shared/ui/index.js";
import { MemoFilterBar, type AuthorFilter } from "~web/widgets/memos/MemoFilterBar.js";
import { MemoListItem } from "~web/widgets/memos/MemoListItem.js";

/** `/memos`. 워크스페이스 전체 메모 관리 화면이다. */
export function MemosPage() {
  const guidance = useGuidance();
  const { data, isLoading, isError } = useMemosQuery();
  const tasksQ = useTasksQuery();
  const taskById = useMemo(() => {
    const m = new Map<TaskId, MonitoringTask>();
    for (const t of tasksQ.data?.tasks ?? []) m.set(t.id, t);
    return m;
  }, [tasksQ.data]);
  const [author, setAuthor] = useState<AuthorFilter>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.memos.filter((memo) => {
      if (author !== "all" && memo.author !== author) return false;
      if (q && !memo.body.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, author, search]);

  return (
    <div className="flex flex-col min-h-0 h-full overflow-auto">
      <header className="px-9 pt-6 pb-4 flex flex-col gap-3 border-b border-hair">
        <div>
          <p className="m-0 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-tertiary">
            Workspace
          </p>
          <h1 className="mt-0.5 mb-0 text-[22px] font-semibold text-ink tracking-[-0.3px]">
            Memos
          </h1>
          <GuidanceText
            as="p"
            className="mt-1 mb-0 text-[12.5px] text-ink-subtle"
            locale={guidance.locale}
            message={guidance.messages.memos.workspaceIntroduction}
          />
          <p className="mt-1 mb-0 text-[12.5px] text-ink-subtle">
            {isLoading
              ? "Loading…"
              : data
                ? `${data.memos.length} memo${data.memos.length === 1 ? "" : "s"}`
                : "Couldn't load memos."}
          </p>
        </div>

        <MemoFilterBar
          author={author}
          onAuthorChange={setAuthor}
          search={search}
          onSearchChange={setSearch}
        />
      </header>

      <div className="px-9 py-6 flex flex-col gap-2.5">
        {isError && (
          <div className="text-err text-[12.5px]">
            <p className="m-0">Couldn't load memos.</p>
            <GuidanceText
              as="p"
              className="mt-1 mb-0"
              locale={guidance.locale}
              message={guidance.messages.memos.loadError}
            />
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          data && data.memos.length === 0 ? (
            <GuidanceText
              as="p"
              className="text-[12.5px] text-ink-subtle text-center py-8"
              locale={guidance.locale}
              message={guidance.messages.memos.workspaceEmpty}
            />
          ) : (
            <p className="text-[12.5px] text-ink-subtle text-center py-8">
              No memos match the current filters.
            </p>
          )
        )}
        {filtered.map((memo) => (
          <MemoListItem key={memo.id} memo={memo} task={taskById.get(memo.taskId) ?? null} />
        ))}
      </div>
    </div>
  );
}
