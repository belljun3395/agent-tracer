import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TaskId } from "../../../types.js";
import {
    fetchWorkflowContent,
    fetchWorkflowLibrary,
    type WorkflowContentRecord,
    type WorkflowSummaryRecord
} from "../../../io.js";
import { cn } from "../../lib/ui/cn.js";
import { Input } from "../ui/Input.js";
import { sortSnapshots } from "./formatting.js";
import { tabButtonClass } from "./primitives.js";
import type { SnapshotFilter } from "./types.js";
import { KnowledgeItemRow } from "./KnowledgeItemRow.js";

interface KnowledgeBaseContentProps {
    readonly onSelectTask: (taskId: string) => void;
}

export function KnowledgeBaseContent({ onSelectTask }: KnowledgeBaseContentProps): React.JSX.Element {
    const [snapshotFilter, setSnapshotFilter] = useState<SnapshotFilter>("all");
    const [search, setSearch] = useState("");
    const [snapshots, setSnapshots] = useState<WorkflowSummaryRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const [workflowContentBySnapshotId, setWorkflowContentBySnapshotId] = useState<Record<string, WorkflowContentRecord>>({});
    const [loadingKey, setLoadingKey] = useState<string | null>(null);
    const [failedKey, setFailedKey] = useState<string | null>(null);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const normalizedSearch = search.trim() || undefined;
            const snapshotData = await fetchWorkflowLibrary(
                snapshotFilter === "all" ? undefined : snapshotFilter,
                normalizedSearch,
                normalizedSearch ? 50 : undefined
            );
            setSnapshots([...sortSnapshots(snapshotData)]);
        }
        catch {
            setSnapshots([]);
        }
        finally {
            setIsLoading(false);
        }
    }, [search, snapshotFilter]);

    useEffect(() => {
        const timer = setTimeout(() => {
            void load();
        }, search.trim() ? 180 : 0);
        return (): void => clearTimeout(timer);
    }, [load, search]);

    const items = useMemo(() => [...sortSnapshots(snapshots)], [snapshots]);

    const openSnapshotDetail = useCallback(async (snapshotId: string, taskId: string, scopeKey: string) => {
        const key = `snapshot:${snapshotId}`;
        if (expandedKey === key) {
            setExpandedKey(null);
            return;
        }
        setExpandedKey(key);
        setFailedKey(null);
        if (workflowContentBySnapshotId[snapshotId]) {
            return;
        }
        setLoadingKey(key);
        try {
            const content = await fetchWorkflowContent(TaskId(taskId), scopeKey);
            setWorkflowContentBySnapshotId((prev) => ({ ...prev, [snapshotId]: content }));
        }
        catch {
            setFailedKey(key);
        }
        finally {
            setLoadingKey((current) => current === key ? null : current);
        }
    }, [expandedKey, workflowContentBySnapshotId]);

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--surface)]">
            <div className="flex shrink-0 items-center gap-2.5 border-b border-[var(--border)] px-4 py-3">
                <span className="text-[0.88rem] font-semibold text-[var(--text-1)]">Knowledge Base</span>
                <span className="rounded-[var(--radius-md)] border border-[var(--border)] px-2 py-0.5 text-[0.64rem] font-semibold text-[var(--text-3)]">
                    {items.length}
                </span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
                <div className="shrink-0 border-b border-[var(--border)] px-4 py-2.5">
                    <div className="flex flex-col gap-1.5">
                        <Input
                            placeholder="Search workflow snapshots and tags..."
                            type="search"
                            value={search}
                            onChange={(event) => { setSearch(event.target.value); }}
                        />
                        <div className="flex flex-wrap gap-1">
                            {(["all", "good", "skip"] as const).map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    className={cn(tabButtonClass, snapshotFilter === value
                                        ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
                                        : "border-[var(--border)] bg-transparent text-[var(--text-3)] hover:text-[var(--text-2)]")}
                                    onClick={() => { setSnapshotFilter(value); }}
                                >
                                    {value}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="px-4 py-5 text-[0.8rem] text-[var(--text-3)]">Loading...</div>
                    ) : items.length === 0 ? (
                        <div className="flex min-h-[18rem] items-center justify-center px-4 text-center text-[0.82rem] text-[var(--text-3)]">
                            {search.trim() ? "No matching workflow snapshots." : "No workflow snapshots yet."}
                        </div>
                    ) : (
                        items.map((item) => (
                            <KnowledgeItemRow
                                key={item.snapshotId}
                                item={item}
                                expandedKey={expandedKey}
                                loadingKey={loadingKey}
                                failedKey={failedKey}
                                workflowContentBySnapshotId={workflowContentBySnapshotId}
                                onOpenSnapshotDetail={(snapshotId, taskId, scopeKey) => { void openSnapshotDetail(snapshotId, taskId, scopeKey); }}
                                onSelectTask={onSelectTask}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
