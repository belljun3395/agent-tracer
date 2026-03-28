/**
 * 워크플로우 라이브러리 패널.
 * 저장된 모든 워크플로우 평가를 목록으로 표시.
 */

import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { fetchWorkflowLibrary, type WorkflowSummaryRecord } from "../api.js";
import { cn } from "../lib/ui/cn.js";

interface WorkflowLibraryPanelProps {
  readonly onSelectTask: (taskId: string) => void;
  readonly onClose: () => void;
}

type RatingFilter = "all" | "good" | "skip";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function WorkflowLibraryPanel({ onSelectTask, onClose }: WorkflowLibraryPanelProps): React.JSX.Element {
  const [items, setItems] = useState<WorkflowSummaryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<RatingFilter>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchWorkflowLibrary(filter === "all" ? undefined : filter);
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const visible = search.trim()
    ? items.filter(item =>
        item.title.toLowerCase().includes(search.toLowerCase())
        || (item.useCase ?? "").toLowerCase().includes(search.toLowerCase())
        || item.workflowTags.some(t => t.toLowerCase().includes(search.toLowerCase()))
        || (item.outcomeNote ?? "").toLowerCase().includes(search.toLowerCase())
        || (item.approachNote ?? "").toLowerCase().includes(search.toLowerCase())
        || (item.reuseWhen ?? "").toLowerCase().includes(search.toLowerCase())
        || (item.watchouts ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : items;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="relative mt-12 flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_64px_rgba(0,0,0,0.18)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] px-4 py-3.5">
          <span className="text-[0.95rem] font-semibold text-[var(--text-1)]">Workflow Library</span>
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[0.7rem] font-semibold text-[var(--text-3)]">
            {items.length}
          </span>
          <div className="flex-1" />
          {/* Rating filter */}
          <div className="flex gap-1">
            {(["all", "good", "skip"] as const).map(f => (
              <button
                key={f}
                type="button"
                className={cn(
                  "rounded-[7px] border px-2.5 py-1 text-[0.72rem] font-semibold capitalize transition-colors",
                  filter === f
                    ? f === "good"
                      ? "border-[var(--ok-bg)] bg-[var(--ok-bg)] text-[var(--ok)]"
                      : f === "skip"
                        ? "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]"
                        : "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
                    : "border-[var(--border)] bg-transparent text-[var(--text-3)] hover:text-[var(--text-2)]"
                )}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            aria-label="Close library"
            className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] text-[0.9rem] text-[var(--text-3)] transition hover:text-[var(--text-1)]"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div className="shrink-0 border-b border-[var(--border)] px-4 py-2.5">
          <input
            className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[0.8rem] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)]"
            placeholder="Filter by title, use case, tags, reuse hints…"
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-[0.82rem] text-[var(--text-3)]">Loading…</div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <span className="text-[0.82rem] text-[var(--text-3)]">
                {items.length === 0
                  ? "No workflows saved yet. Complete a task and evaluate it to add it here."
                  : "No matches for your search."}
              </span>
            </div>
          ) : (
            visible.map(item => (
              <button
                key={item.taskId}
                type="button"
                className="flex w-full flex-col items-start gap-2 border-b border-[var(--border)] px-4 py-3.5 text-left transition-colors last:border-0 hover:bg-[var(--surface-2)]"
                onClick={() => { onSelectTask(item.taskId); onClose(); }}
              >
                <div className="flex w-full items-start gap-2">
                  {/* Rating badge */}
                  <span className={cn(
                    "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[0.67rem] font-semibold",
                    item.rating === "good"
                      ? "bg-[var(--ok-bg)] text-[var(--ok)]"
                      : "bg-[var(--surface-2)] text-[var(--text-3)]"
                  )}>
                    {item.rating === "good" ? "Good" : "Skip"}
                  </span>
                  <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <span className="truncate text-[0.85rem] font-semibold text-[var(--text-1)]">{item.title}</span>
                    {item.useCase && (
                      <span className="text-[0.78rem] text-[var(--text-2)]">{item.useCase}</span>
                    )}
                  </div>
                  <span className="shrink-0 text-[0.72rem] text-[var(--text-3)]">{formatDate(item.evaluatedAt)}</span>
                </div>

                {/* Tags */}
                {item.workflowTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.workflowTags.map(tag => (
                      <span
                        key={tag}
                        className="rounded-full border border-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 text-[0.68rem] text-[var(--accent)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {item.outcomeNote && (
                  <p className="m-0 line-clamp-2 text-[0.77rem] leading-relaxed text-[var(--text-2)]">
                    Outcome: {item.outcomeNote}
                  </p>
                )}
                {item.approachNote && (
                  <p className="m-0 line-clamp-2 text-[0.76rem] leading-relaxed text-[var(--text-3)]">
                    What worked: {item.approachNote}
                  </p>
                )}
                {item.reuseWhen && (
                  <p className="m-0 line-clamp-2 text-[0.76rem] leading-relaxed text-[var(--accent)]">
                    Reuse when: {item.reuseWhen}
                  </p>
                )}
                {item.watchouts && (
                  <p className="m-0 line-clamp-2 text-[0.76rem] leading-relaxed text-[var(--danger)]">
                    Watch out: {item.watchouts}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
