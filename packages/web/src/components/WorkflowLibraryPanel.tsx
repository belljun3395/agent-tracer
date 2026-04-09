import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { fetchWorkflowContent, fetchWorkflowLibrary, type WorkflowContentRecord, type WorkflowSummaryRecord } from "../api.js";
import { cn } from "../lib/ui/cn.js";
interface WorkflowLibraryPanelProps {
    readonly onSelectTask: (taskId: string) => void;
    readonly onClose: () => void;
}
type RatingFilter = "all" | "good" | "skip";
function formatDate(iso: string): string {
    const date = new Date(iso);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function SnapshotField({ label, value }: {
    readonly label: string;
    readonly value: string | null;
}): React.JSX.Element | null {
    if (!value) {
        return null;
    }
    return (<div className="flex flex-col gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">{label}</span>
      <p className="m-0 whitespace-pre-wrap break-words text-[0.84rem] leading-7 text-[var(--text-1)]">{value}</p>
    </div>);
}
function SnapshotList({ label, items }: {
    readonly label: string;
    readonly items: readonly string[];
}): React.JSX.Element | null {
    if (items.length === 0) {
        return null;
    }
    return (<div className="flex flex-col gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">{label}</span>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (<p key={item} className="m-0 whitespace-pre-wrap break-words text-[0.84rem] leading-7 text-[var(--text-1)]">
            - {item}
          </p>))}
      </div>
    </div>);
}
function WorkflowContentDetail({ content }: {
    readonly content: WorkflowContentRecord;
}): React.JSX.Element {
    const snapshot = content.workflowSnapshot;
    return (<div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
      <div className="mb-3 flex flex-col gap-1">
        <span className="text-[0.78rem] font-semibold text-[var(--text-1)]">Workflow content</span>
        <span className="text-[0.73rem] leading-relaxed text-[var(--text-3)]">
          {content.source === "saved"
            ? "Saved workflow snapshot/context shown below."
            : "No explicit override was saved, so this is generated from the task timeline."}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        <SnapshotField label="Objective" value={snapshot.objective}/>
        <SnapshotField label="Original Request" value={snapshot.originalRequest}/>
        <SnapshotField label="Outcome Summary" value={snapshot.outcomeSummary}/>
        <SnapshotField label="Approach Summary" value={snapshot.approachSummary}/>
        <SnapshotField label="Reuse When" value={snapshot.reuseWhen}/>
        <SnapshotField label="Verification Summary" value={snapshot.verificationSummary}/>
        <SnapshotField label="Search Text" value={snapshot.searchText}/>
        <SnapshotList label="Key Decisions" items={snapshot.keyDecisions}/>
        <SnapshotList label="Next Steps" items={snapshot.nextSteps}/>
        <SnapshotList label="Watch Items" items={snapshot.watchItems}/>
        <SnapshotList label="Key Files" items={snapshot.keyFiles}/>
        <SnapshotList label="Modified Files" items={snapshot.modifiedFiles}/>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Workflow Context</span>
        <pre className="m-0 max-h-[30rem] overflow-auto whitespace-pre-wrap break-words rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[0.8rem] leading-7 text-[var(--text-2)]">
          {content.workflowContext}
        </pre>
      </div>
    </div>);
}
export function WorkflowLibraryPanel({ onSelectTask, onClose }: WorkflowLibraryPanelProps): React.JSX.Element {
    const [items, setItems] = useState<WorkflowSummaryRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<RatingFilter>("all");
    const [search, setSearch] = useState("");
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
    const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);
    const [failedTaskId, setFailedTaskId] = useState<string | null>(null);
    const [contentByTaskId, setContentByTaskId] = useState<Record<string, WorkflowContentRecord>>({});
    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const normalizedSearch = search.trim();
            const data = await fetchWorkflowLibrary(filter === "all" ? undefined : filter, normalizedSearch || undefined, normalizedSearch ? 50 : undefined);
            setItems(data);
        }
        catch {
            setItems([]);
        }
        finally {
            setIsLoading(false);
        }
    }, [filter, search]);
    const toggleExpanded = useCallback(async (item: WorkflowSummaryRecord) => {
        if (expandedTaskId === item.taskId) {
            setExpandedTaskId(null);
            return;
        }
        setExpandedTaskId(item.taskId);
        setFailedTaskId(null);
        if (contentByTaskId[item.taskId]) {
            return;
        }
        setLoadingTaskId(item.taskId);
        try {
            const content = await fetchWorkflowContent(item.taskId);
            setContentByTaskId((prev) => ({ ...prev, [item.taskId]: content }));
        }
        catch {
            setFailedTaskId(item.taskId);
        }
        finally {
            setLoadingTaskId((current) => current === item.taskId ? null : current);
        }
    }, [contentByTaskId, expandedTaskId]);
    useEffect(() => {
        const timer = setTimeout(() => {
            void load();
        }, search.trim() ? 180 : 0);
        return (): void => clearTimeout(timer);
    }, [load, search]);
    return (<div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <div className="relative mt-12 flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_64px_rgba(0,0,0,0.18)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] px-4 py-3.5">
          <span className="text-[0.95rem] font-semibold text-[var(--text-1)]">Workflow Library</span>
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[0.7rem] font-semibold text-[var(--text-3)]">
            {items.length}
          </span>
          <div className="flex-1"/>
          <div className="flex gap-1">
            {(["all", "good", "skip"] as const).map((value) => (<button key={value} type="button" className={cn("rounded-[7px] border px-2.5 py-1 text-[0.72rem] font-semibold capitalize transition-colors", filter === value
                ? value === "good"
                    ? "border-[var(--ok-bg)] bg-[var(--ok-bg)] text-[var(--ok)]"
                    : value === "skip"
                        ? "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]"
                        : "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
                : "border-[var(--border)] bg-transparent text-[var(--text-3)] hover:text-[var(--text-2)]")} onClick={() => setFilter(value)}>
                {value}
              </button>))}
          </div>
          <button aria-label="Close library" className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] text-[0.9rem] text-[var(--text-3)] transition hover:text-[var(--text-1)]" onClick={onClose} type="button">
            ×
          </button>
        </div>

        <div className="shrink-0 border-b border-[var(--border)] px-4 py-2.5">
          <input className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[0.8rem] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)]" placeholder="Search by title, intent, tags, reuse hints…" type="search" value={search} onChange={(event) => setSearch(event.target.value)}/>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (<div className="flex items-center justify-center py-12 text-[0.82rem] text-[var(--text-3)]">Loading…</div>) : items.length === 0 ? (<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <span className="text-[0.82rem] text-[var(--text-3)]">
                {search.trim()
                ? "No workflows matched your semantic search."
                : "No workflows saved yet. Complete a task and evaluate it to add it here."}
              </span>
            </div>) : (items.map((item) => {
            const content = contentByTaskId[item.taskId];
            return (<div key={item.taskId} className="border-b border-[var(--border)] last:border-0">
                  <div className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--surface-2)]">
                    <button type="button" className="flex min-w-0 flex-1 flex-col items-start gap-2 text-left" onClick={() => {
                    onSelectTask(item.taskId);
                    onClose();
                }}>
                      <div className="flex w-full items-start gap-2">
                        <span className={cn("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[0.67rem] font-semibold", item.rating === "good"
                    ? "bg-[var(--ok-bg)] text-[var(--ok)]"
                    : "bg-[var(--surface-2)] text-[var(--text-3)]")}>
                          {item.rating === "good" ? "Good" : "Skip"}
                        </span>
                        <div className="min-w-0 flex flex-1 flex-col gap-0.5">
                          <span className="truncate text-[0.85rem] font-semibold text-[var(--text-1)]">
                            {item.displayTitle ?? item.title}
                          </span>
                          {item.useCase && (<span className="text-[0.78rem] text-[var(--text-2)]">{item.useCase}</span>)}
                        </div>
                        <span className="shrink-0 text-[0.72rem] text-[var(--text-3)]">{formatDate(item.evaluatedAt)}</span>
                      </div>

                      {item.workflowTags.length > 0 && (<div className="flex flex-wrap gap-1">
                          {item.workflowTags.map((tag) => (<span key={tag} className="rounded-full border border-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 text-[0.68rem] text-[var(--accent)]">
                              {tag}
                            </span>))}
                        </div>)}

                      {item.outcomeNote && (<p className="m-0 line-clamp-2 text-[0.77rem] leading-relaxed text-[var(--text-2)]">
                          Outcome: {item.outcomeNote}
                        </p>)}
                      {item.approachNote && (<p className="m-0 line-clamp-2 text-[0.76rem] leading-relaxed text-[var(--text-3)]">
                          What worked: {item.approachNote}
                        </p>)}
                    </button>

                    <div className="flex shrink-0 flex-col gap-2">
                      <button type="button" className="rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[0.72rem] font-semibold text-[var(--text-2)] transition-colors hover:text-[var(--text-1)]" onClick={() => { void toggleExpanded(item); }}>
                        {expandedTaskId === item.taskId ? "Hide Content" : "Workflow Content"}
                      </button>
                    </div>
                  </div>

                  {expandedTaskId === item.taskId && (<>
                      {loadingTaskId === item.taskId ? (<div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[0.76rem] text-[var(--text-3)]">
                          Loading workflow content…
                        </div>) : failedTaskId === item.taskId ? (<div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[0.76rem] text-[var(--danger)]">
                          Failed to load workflow content.
                        </div>) : content ? (<WorkflowContentDetail content={content}/>) : null}
                    </>)}
                </div>);
        }))}
        </div>
      </div>
    </div>);
}
