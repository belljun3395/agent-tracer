import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TaskId } from "../../../types.js";
import {
    createPlaybook,
    fetchPlaybook,
    fetchPlaybooks,
    fetchWorkflowContent,
    fetchWorkflowLibrary,
    updatePlaybook,
    type PlaybookRecordResponse,
    type PlaybookSummaryRecord,
    type WorkflowContentRecord,
    type WorkflowSummaryRecord
} from "../../../io.js";
import { cn } from "../../lib/ui/cn.js";
import { Button } from "../ui/Button.js";
import { Input } from "../ui/Input.js";
import {
    createDraftFromPlaybook,
    createDraftFromSnapshot,
    createEmptyEditorDraft,
    buildPlaybookPayloadFromDraft,
} from "./editor-draft.js";
import {
    sortPlaybooks,
    sortSnapshots,
} from "./formatting.js";
import {
    tabButtonClass,
} from "./primitives.js";
import type {
    EditorDraft,
    EditorMode,
    KnowledgeItem,
    PlaybookFilter,
    SnapshotFilter,
    TabKey,
} from "./types.js";
import { KnowledgeItemRow } from "./KnowledgeItemRow.js";
import { PlaybookEditor } from "./PlaybookEditor.js";

interface KnowledgeBaseContentProps {
    readonly onSelectTask: (taskId: string) => void;
}

export function KnowledgeBaseContent({ onSelectTask }: KnowledgeBaseContentProps): React.JSX.Element {
    const [activeTab, setActiveTab] = useState<TabKey>("library");
    const [snapshotFilter, setSnapshotFilter] = useState<SnapshotFilter>("all");
    const [playbookFilter, setPlaybookFilter] = useState<PlaybookFilter>("all");
    const [search, setSearch] = useState("");
    const [snapshots, setSnapshots] = useState<WorkflowSummaryRecord[]>([]);
    const [playbooks, setPlaybooks] = useState<PlaybookSummaryRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const [workflowContentBySnapshotId, setWorkflowContentBySnapshotId] = useState<Record<string, WorkflowContentRecord>>({});
    const [playbookById, setPlaybookById] = useState<Record<string, PlaybookRecordResponse>>({});
    const [loadingKey, setLoadingKey] = useState<string | null>(null);
    const [failedKey, setFailedKey] = useState<string | null>(null);
    const [editorMode, setEditorMode] = useState<EditorMode | null>(null);
    const [editorDraft, setEditorDraft] = useState<EditorDraft>(createEmptyEditorDraft());
    const [isSavingPlaybook, setIsSavingPlaybook] = useState(false);
    const [playbookSaveError, setPlaybookSaveError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const normalizedSearch = search.trim() || undefined;
            const [snapshotData, playbookData] = await Promise.all([
                fetchWorkflowLibrary(snapshotFilter === "all" ? undefined : snapshotFilter, normalizedSearch, normalizedSearch ? 50 : undefined),
                fetchPlaybooks(normalizedSearch, playbookFilter === "all" ? undefined : playbookFilter, normalizedSearch ? 50 : undefined)
            ]);
            setSnapshots([...sortSnapshots(snapshotData)]);
            setPlaybooks([...sortPlaybooks(playbookData)]);
        }
        catch {
            setSnapshots([]);
            setPlaybooks([]);
        }
        finally {
            setIsLoading(false);
        }
    }, [playbookFilter, search, snapshotFilter]);

    useEffect(() => {
        const timer = setTimeout(() => {
            void load();
        }, search.trim() ? 180 : 0);
        return (): void => clearTimeout(timer);
    }, [load, search]);

    const items = useMemo<KnowledgeItem[]>(() => {
        if (activeTab === "playbooks") {
            return [...sortPlaybooks(playbooks)];
        }
        return [...sortSnapshots(snapshots)];
    }, [activeTab, playbooks, snapshots]);

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

    const openPlaybookDetail = useCallback(async (playbookId: string) => {
        const key = `playbook:${playbookId}`;
        if (expandedKey === key) {
            setExpandedKey(null);
            return;
        }
        setExpandedKey(key);
        setFailedKey(null);
        if (playbookById[playbookId]) {
            return;
        }
        setLoadingKey(key);
        try {
            const playbook = await fetchPlaybook(playbookId);
            setPlaybookById((prev) => ({ ...prev, [playbookId]: playbook }));
        }
        catch {
            setFailedKey(key);
        }
        finally {
            setLoadingKey((current) => current === key ? null : current);
        }
    }, [expandedKey, playbookById]);

    const handlePromoteSnapshot = useCallback((content: WorkflowContentRecord) => {
        setEditorMode("create");
        setEditorDraft(createDraftFromSnapshot(content));
    }, []);

    const handleEditPlaybook = useCallback((playbook: PlaybookRecordResponse) => {
        setEditorMode("edit");
        setEditorDraft(createDraftFromPlaybook(playbook));
    }, []);

    const handleSavePlaybook = useCallback(async () => {
        if (!editorDraft.title.trim()) {
            return;
        }
        setIsSavingPlaybook(true);
        setPlaybookSaveError(null);
        try {
            const payload = buildPlaybookPayloadFromDraft(editorDraft);
            const saved = editorMode === "edit" && editorDraft.id
                ? await updatePlaybook(editorDraft.id, payload)
                : await createPlaybook(payload);
            setPlaybookById((prev) => ({ ...prev, [saved.id]: saved }));
            setEditorMode(null);
            setEditorDraft(createEmptyEditorDraft());
            await load();
            setExpandedKey(`playbook:${saved.id}`);
        }
        catch (error) {
            setPlaybookSaveError(error instanceof Error ? error.message : "Failed to save playbook");
        }
        finally {
            setIsSavingPlaybook(false);
        }
    }, [editorDraft, editorMode, load]);

    const handleEditorChange = useCallback((update: Partial<EditorDraft>) => {
        setEditorDraft((prev) => ({ ...prev, ...update }));
    }, []);

    const handleEditorCancel = useCallback(() => {
        setEditorMode(null);
        setEditorDraft(createEmptyEditorDraft());
        setPlaybookSaveError(null);
    }, []);

    const handleEditorSave = useCallback(() => {
        void handleSavePlaybook();
    }, [handleSavePlaybook]);

    const handleStartCreate = useCallback(() => {
        setEditorMode("create");
        setEditorDraft(createEmptyEditorDraft());
    }, []);

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--surface)]">
            <div className="flex shrink-0 items-center gap-2.5 border-b border-[var(--border)] px-4 py-3">
                <span className="text-[0.88rem] font-semibold text-[var(--text-1)]">Knowledge Base</span>
                <span className="rounded-[var(--radius-md)] border border-[var(--border)] px-2 py-0.5 text-[0.64rem] font-semibold text-[var(--text-3)]">
                    {items.length}
                </span>
                <div className="flex gap-1">
                    {([
                        ["library", "Library"],
                        ["playbooks", "Playbooks"]
                    ] as const).map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            className={cn(tabButtonClass, activeTab === value
                                ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
                                : "border-[var(--border)] bg-transparent text-[var(--text-3)] hover:text-[var(--text-2)]")}
                            onClick={() => { setActiveTab(value); }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className="flex-1"/>
                {activeTab === "playbooks" ? (
                    <Button size="sm" variant="accent" onClick={handleStartCreate}>
                        Create Playbook
                    </Button>
                ) : null}
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px]">
                <div className="flex min-h-0 flex-col border-r border-[var(--border)]">
                    <div className="shrink-0 border-b border-[var(--border)] px-4 py-2.5">
                        <div className="flex flex-col gap-1.5">
                            <Input
                                placeholder="Search snapshots, playbooks, tags…"
                                type="search"
                                value={search}
                                onChange={(event) => { setSearch(event.target.value); }}
                            />
                            <div className="flex flex-wrap gap-1">
                                {activeTab === "playbooks"
                                    ? (["all", "active", "draft", "archived"] as const).map((value) => (
                                        <button
                                            key={value}
                                            type="button"
                                            className={cn(tabButtonClass, playbookFilter === value
                                                ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
                                                : "border-[var(--border)] bg-transparent text-[var(--text-3)] hover:text-[var(--text-2)]")}
                                            onClick={() => { setPlaybookFilter(value); }}
                                        >
                                            {value}
                                        </button>
                                    ))
                                    : (["all", "good", "skip"] as const).map((value) => (
                                        <button
                                            key={value}
                                            type="button"
                                            className={cn(tabButtonClass, snapshotFilter === value
                                                ? value === "good"
                                                    ? "border-[var(--ok-bg)] bg-[var(--ok-bg)] text-[var(--ok)]"
                                                    : value === "skip"
                                                        ? "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]"
                                                        : "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
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
                            <div className="flex items-center justify-center py-10 text-[0.78rem] text-[var(--text-3)]">Loading…</div>
                        ) : items.length === 0 ? (
                            <div className="flex min-h-[22rem] flex-col items-center justify-center px-6 py-12 text-center">
                                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-2)_72%,var(--surface))] text-[var(--text-3)]">
                                    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="18">
                                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                                        <path d="M8 7h8"/>
                                        <path d="M8 11h6"/>
                                    </svg>
                                </div>
                                <p className="m-0 text-[0.9rem] font-semibold text-[var(--text-1)]">
                                    {search.trim()
                                        ? "No matching knowledge"
                                        : activeTab === "playbooks"
                                            ? "No playbooks yet"
                                            : "No snapshots yet"}
                                </p>
                                <p className="m-0 mt-1 max-w-[24rem] text-[0.78rem] leading-6 text-[var(--text-3)]">
                                    {search.trim()
                                        ? "Try a broader keyword or clear the current filters."
                                        : activeTab === "playbooks"
                                            ? "Promote a proven snapshot or draft a reusable workflow from scratch."
                                            : "Complete a task and save the useful outcome to start building the library."}
                                </p>
                                {activeTab === "playbooks" && !search.trim() ? (
                                    <Button className="mt-4" size="sm" variant="accent" onClick={handleStartCreate}>
                                        Create Playbook
                                    </Button>
                                ) : null}
                            </div>
                        ) : items.map((item) => {
                            const rowKey = item.layer === "snapshot" ? `snapshot:${item.snapshotId}` : `playbook:${item.id}`;
                            return (
                                <KnowledgeItemRow
                                    key={rowKey}
                                    item={item}
                                    expandedKey={expandedKey}
                                    loadingKey={loadingKey}
                                    failedKey={failedKey}
                                    workflowContentByTaskId={workflowContentBySnapshotId}
                                    playbookById={playbookById}
                                    onOpenSnapshotDetail={(snapshotId, taskId, scopeKey) => { void openSnapshotDetail(snapshotId, taskId, scopeKey); }}
                                    onOpenPlaybookDetail={(playbookId) => { void openPlaybookDetail(playbookId); }}
                                    onSelectTask={onSelectTask}
                                    onPromoteSnapshot={handlePromoteSnapshot}
                                    onEditPlaybook={handleEditPlaybook}
                                />
                            );
                        })}
                    </div>
                </div>

                <PlaybookEditor
                    draft={editorDraft}
                    mode={editorMode}
                    isSaving={isSavingPlaybook}
                    saveError={playbookSaveError}
                    onChange={handleEditorChange}
                    onSave={handleEditorSave}
                    onCancel={handleEditorCancel}
                    onStartCreate={handleStartCreate}
                />
            </div>
        </div>
    );
}
