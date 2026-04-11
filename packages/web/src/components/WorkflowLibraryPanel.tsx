import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TaskId } from "@monitor/core";
import {
    createPlaybook,
    fetchPlaybook,
    fetchPlaybooks,
    fetchWorkflowContent,
    fetchWorkflowLibrary,
    updatePlaybook,
    type PlaybookPayload,
    type PlaybookRecordResponse,
    type PlaybookSummaryRecord,
    type WorkflowContentRecord,
    type WorkflowSummaryRecord
} from "@monitor/web-core";
import { cn } from "../lib/ui/cn.js";
import { Badge } from "./ui/Badge.js";
import { Button } from "./ui/Button.js";
import { Eyebrow } from "./ui/Eyebrow.js";
import { Input } from "./ui/Input.js";
import { Textarea } from "./ui/Textarea.js";

interface WorkflowLibraryPanelProps {
    readonly onSelectTask: (taskId: string) => void;
    readonly onClose: () => void;
}

type SnapshotFilter = "all" | "good" | "skip";
type PlaybookFilter = "all" | "active" | "draft" | "archived";
type TabKey = "library" | "playbooks";
type EditorMode = "create" | "edit";
type EditorDraft = {
    readonly id?: string;
    title: string;
    status: "draft" | "active" | "archived";
    whenToUse: string;
    prerequisites: string;
    approach: string;
    keySteps: string;
    watchouts: string;
    antiPatterns: string;
    failureModes: string;
    tags: string;
    sourceSnapshotIds: readonly string[];
};
type KnowledgeItem = WorkflowSummaryRecord | PlaybookSummaryRecord;

const tabButtonClass = "rounded-[7px] border px-2.5 py-1 text-[0.72rem] font-semibold transition-colors";
const editorFieldClass = "flex flex-col gap-1.5";

function formatDate(iso: string | null | undefined): string | null {
    if (!iso) {
        return null;
    }
    const date = new Date(iso);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function SectionLabel({ children }: { readonly children: React.ReactNode; }): React.JSX.Element {
    return <Eyebrow className="text-[0.72rem] tracking-[0.06em]">{children}</Eyebrow>;
}

function SnapshotField({ label, value }: {
    readonly label: string;
    readonly value: string | null;
}): React.JSX.Element | null {
    if (!value) {
        return null;
    }
    return (
        <div className="flex flex-col gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
            <Eyebrow>{label}</Eyebrow>
            <p className="m-0 whitespace-pre-wrap break-words text-[0.84rem] leading-7 text-[var(--text-1)]">{value}</p>
        </div>
    );
}

function SnapshotList({ label, items }: {
    readonly label: string;
    readonly items: readonly string[];
}): React.JSX.Element | null {
    if (items.length === 0) {
        return null;
    }
    return (
        <div className="flex flex-col gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
            <Eyebrow>{label}</Eyebrow>
            <div className="flex flex-col gap-1.5">
                {items.map((item) => (
                    <p key={item} className="m-0 whitespace-pre-wrap break-words text-[0.84rem] leading-7 text-[var(--text-1)]">
                        - {item}
                    </p>
                ))}
            </div>
        </div>
    );
}

function WorkflowContentDetail({ content, onPromote }: {
    readonly content: WorkflowContentRecord;
    readonly onPromote: () => void;
}): React.JSX.Element {
    const snapshot = content.workflowSnapshot;
    return (
        <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <span className="text-[0.78rem] font-semibold text-[var(--text-1)]">Snapshot</span>
                    <span className="text-[0.73rem] leading-relaxed text-[var(--text-3)]">
                        {content.source === "saved"
                            ? "Saved snapshot/context shown below."
                            : "No explicit override was saved, so this snapshot is generated from the task timeline."}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Badge tone="accent" size="xs">v{content.version}</Badge>
                    <Badge tone="neutral" size="xs">reuse {content.qualitySignals.reuseCount}</Badge>
                    {content.promotedTo ? <Badge tone="warning" size="xs">Promoted</Badge> : null}
                    <Button size="sm" onClick={onPromote}>Promote to Playbook</Button>
                </div>
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
                <Eyebrow>Snapshot Context</Eyebrow>
                <pre className="m-0 max-h-[30rem] overflow-auto whitespace-pre-wrap break-words rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[0.8rem] leading-7 text-[var(--text-2)]">
                    {content.workflowContext}
                </pre>
            </div>
        </div>
    );
}

function PlaybookDetail({ playbook, onEdit }: {
    readonly playbook: PlaybookRecordResponse;
    readonly onEdit: () => void;
}): React.JSX.Element {
    return (
        <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <span className="text-[0.78rem] font-semibold text-[var(--text-1)]">Playbook</span>
                    <span className="text-[0.73rem] leading-relaxed text-[var(--text-3)]">
                        Curated knowledge for repeating this kind of work.
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Badge tone={playbook.status === "active" ? "warning" : playbook.status === "draft" ? "accent" : "neutral"} size="xs">
                        {playbook.status}
                    </Badge>
                    <Badge tone="neutral" size="xs">used {playbook.useCount}</Badge>
                    <Button size="sm" onClick={onEdit}>Edit Playbook</Button>
                </div>
            </div>

            <div className="flex flex-col gap-2.5">
                <SnapshotField label="When to Use" value={playbook.whenToUse}/>
                <SnapshotField label="Approach" value={playbook.approach}/>
                <SnapshotField label="Search Text" value={playbook.searchText}/>
                <SnapshotList label="Prerequisites" items={playbook.prerequisites}/>
                <SnapshotList label="Key Steps" items={playbook.keySteps}/>
                <SnapshotList label="Watchouts" items={playbook.watchouts}/>
                <SnapshotList label="Anti-patterns" items={playbook.antiPatterns}/>
                <SnapshotList label="Common Failure Modes" items={playbook.failureModes}/>
                <SnapshotList label="Related Playbooks" items={playbook.relatedPlaybookIds}/>
                <SnapshotList label="Source Snapshots" items={playbook.sourceSnapshotIds}/>
            </div>
        </div>
    );
}

function createEmptyEditorDraft(): EditorDraft {
    return {
        title: "",
        status: "draft",
        whenToUse: "",
        prerequisites: "",
        approach: "",
        keySteps: "",
        watchouts: "",
        antiPatterns: "",
        failureModes: "",
        tags: "",
        sourceSnapshotIds: []
    };
}

function createDraftFromSnapshot(content: WorkflowContentRecord): EditorDraft {
    return {
        title: content.workflowSnapshot.objective || content.title,
        status: "draft",
        whenToUse: content.workflowSnapshot.reuseWhen ?? "",
        prerequisites: "",
        approach: content.workflowSnapshot.approachSummary ?? "",
        keySteps: content.workflowSnapshot.keyDecisions.join("\n"),
        watchouts: content.workflowSnapshot.watchItems.join("\n"),
        antiPatterns: "",
        failureModes: "",
        tags: "",
        sourceSnapshotIds: [`${content.taskId}:v${content.version}`]
    };
}

function createDraftFromPlaybook(playbook: PlaybookRecordResponse): EditorDraft {
    return {
        id: playbook.id,
        title: playbook.title,
        status: playbook.status,
        whenToUse: playbook.whenToUse ?? "",
        prerequisites: playbook.prerequisites.join("\n"),
        approach: playbook.approach ?? "",
        keySteps: playbook.keySteps.join("\n"),
        watchouts: playbook.watchouts.join("\n"),
        antiPatterns: playbook.antiPatterns.join("\n"),
        failureModes: playbook.failureModes.join("\n"),
        tags: playbook.tags.join(", "),
        sourceSnapshotIds: playbook.sourceSnapshotIds
    };
}

function normalizeLines(value: string): string[] {
    return value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function normalizeTags(value: string): string[] {
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function buildPlaybookPayloadFromDraft(draft: EditorDraft): PlaybookPayload {
    return {
        title: draft.title.trim(),
        status: draft.status,
        ...(draft.whenToUse.trim() ? { whenToUse: draft.whenToUse.trim() } : {}),
        ...(draft.approach.trim() ? { approach: draft.approach.trim() } : {}),
        ...(normalizeLines(draft.prerequisites).length > 0 ? { prerequisites: normalizeLines(draft.prerequisites) } : {}),
        ...(normalizeLines(draft.keySteps).length > 0 ? { keySteps: normalizeLines(draft.keySteps) } : {}),
        ...(normalizeLines(draft.watchouts).length > 0 ? { watchouts: normalizeLines(draft.watchouts) } : {}),
        ...(normalizeLines(draft.antiPatterns).length > 0 ? { antiPatterns: normalizeLines(draft.antiPatterns) } : {}),
        ...(normalizeLines(draft.failureModes).length > 0 ? { failureModes: normalizeLines(draft.failureModes) } : {}),
        ...(normalizeTags(draft.tags).length > 0 ? { tags: normalizeTags(draft.tags) } : {}),
        ...(draft.sourceSnapshotIds.length > 0 ? { sourceSnapshotIds: [...draft.sourceSnapshotIds] } : {})
    };
}

function sortSnapshots(items: readonly WorkflowSummaryRecord[]): readonly WorkflowSummaryRecord[] {
    return [...items].sort((left, right) => Date.parse(right.evaluatedAt) - Date.parse(left.evaluatedAt));
}

function sortPlaybooks(items: readonly PlaybookSummaryRecord[]): readonly PlaybookSummaryRecord[] {
    const rank = (status: PlaybookSummaryRecord["status"]): number => status === "active" ? 3 : status === "draft" ? 2 : 1;
    return [...items].sort((left, right) => rank(right.status) - rank(left.status) || Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export function WorkflowLibraryPanel({ onSelectTask, onClose }: WorkflowLibraryPanelProps): React.JSX.Element {
    const [activeTab, setActiveTab] = useState<TabKey>("library");
    const [snapshotFilter, setSnapshotFilter] = useState<SnapshotFilter>("all");
    const [playbookFilter, setPlaybookFilter] = useState<PlaybookFilter>("all");
    const [search, setSearch] = useState("");
    const [snapshots, setSnapshots] = useState<WorkflowSummaryRecord[]>([]);
    const [playbooks, setPlaybooks] = useState<PlaybookSummaryRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const [workflowContentByTaskId, setWorkflowContentByTaskId] = useState<Record<string, WorkflowContentRecord>>({});
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
            return playbooks;
        }
        return [...sortPlaybooks(playbooks), ...sortSnapshots(snapshots)];
    }, [activeTab, playbooks, snapshots]);

    const openSnapshotDetail = useCallback(async (taskId: string) => {
        const key = `snapshot:${taskId}`;
        if (expandedKey === key) {
            setExpandedKey(null);
            return;
        }
        setExpandedKey(key);
        setFailedKey(null);
        if (workflowContentByTaskId[taskId]) {
            return;
        }
        setLoadingKey(key);
        try {
            const content = await fetchWorkflowContent(TaskId(taskId));
            setWorkflowContentByTaskId((prev) => ({ ...prev, [taskId]: content }));
        }
        catch {
            setFailedKey(key);
        }
        finally {
            setLoadingKey((current) => current === key ? null : current);
        }
    }, [expandedKey, workflowContentByTaskId]);

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

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
            <div className="relative mt-12 flex max-h-[84vh] w-full max-w-5xl flex-col overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_64px_rgba(0,0,0,0.18)]" onClick={(event) => event.stopPropagation()}>
                <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] px-4 py-3.5">
                    <span className="text-[0.95rem] font-semibold text-[var(--text-1)]">Knowledge Base</span>
                    <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[0.7rem] font-semibold text-[var(--text-3)]">
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
                                onClick={() => setActiveTab(value)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1"/>
                    {activeTab === "playbooks" ? (
                        <Button size="sm" onClick={() => {
                            setEditorMode("create");
                            setEditorDraft(createEmptyEditorDraft());
                        }}>
                            Create Playbook
                        </Button>
                    ) : null}
                    <button aria-label="Close knowledge base" className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] text-[0.9rem] text-[var(--text-3)] transition hover:text-[var(--text-1)]" onClick={onClose} type="button">
                        ×
                    </button>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px]">
                    <div className="flex min-h-0 flex-col border-r border-[var(--border)]">
                        <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
                            <div className="flex flex-col gap-2">
                                <Input
                                    placeholder="Search snapshots, playbooks, tags…"
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
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
                                                onClick={() => setPlaybookFilter(value)}
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
                                                onClick={() => setSnapshotFilter(value)}
                                            >
                                                {value}
                                            </button>
                                        ))}
                                </div>
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-12 text-[0.82rem] text-[var(--text-3)]">Loading…</div>
                            ) : items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                                    <span className="text-[0.82rem] text-[var(--text-3)]">
                                        {search.trim()
                                            ? "No matches. Try different keywords or browse all items."
                                            : activeTab === "playbooks"
                                                ? "No playbooks yet. Promote a proven snapshot to create your first playbook."
                                                : "No snapshots yet. Complete a task and save it to start building your knowledge base."}
                                    </span>
                                </div>
                            ) : items.map((item) => {
                                const key = `${item.layer}:${item.layer === "snapshot" ? item.taskId : item.id}`;
                                const isExpanded = expandedKey === key;
                                return (
                                    <div key={key} className="border-b border-[var(--border)] last:border-0">
                                        <div className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--surface-2)]">
                                            <div className="min-w-0 flex flex-1 flex-col gap-2">
                                                <div className="flex items-start gap-2">
                                                    <Badge tone={item.layer === "playbook" ? "warning" : "accent"} size="xs">
                                                        {item.layer === "playbook" ? "Playbook" : "Snapshot"}
                                                    </Badge>
                                                    {item.layer === "snapshot" ? (
                                                        <span className={cn("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[0.67rem] font-semibold", item.rating === "good"
                                                            ? "bg-[var(--ok-bg)] text-[var(--ok)]"
                                                            : "bg-[var(--surface-2)] text-[var(--text-3)]")}>
                                                            {item.rating === "good" ? "Good" : "Skip"}
                                                        </span>
                                                    ) : (
                                                        <Badge tone={item.status === "active" ? "warning" : item.status === "draft" ? "accent" : "neutral"} size="xs">
                                                            {item.status}
                                                        </Badge>
                                                    )}
                                                    <div className="min-w-0 flex flex-1 flex-col gap-0.5">
                                                        <span className="truncate text-[0.85rem] font-semibold text-[var(--text-1)]">
                                                            {item.layer === "snapshot" ? (item.displayTitle ?? item.title) : item.title}
                                                        </span>
                                                        {item.layer === "snapshot" ? (
                                                            item.useCase ? <span className="text-[0.78rem] text-[var(--text-2)]">{item.useCase}</span> : null
                                                        ) : (
                                                            item.whenToUse ? <span className="text-[0.78rem] text-[var(--text-2)]">{item.whenToUse}</span> : null
                                                        )}
                                                    </div>
                                                    <span className="shrink-0 text-[0.72rem] text-[var(--text-3)]">
                                                        {item.layer === "snapshot" ? formatDate(item.evaluatedAt) : formatDate(item.updatedAt)}
                                                    </span>
                                                </div>

                                                {"workflowTags" in item && item.workflowTags.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {item.workflowTags.map((tag) => (
                                                            <span key={tag} className="rounded-full border border-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 text-[0.68rem] text-[var(--accent)]">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : "tags" in item && item.tags.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {item.tags.map((tag) => (
                                                            <span key={tag} className="rounded-full border border-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 text-[0.68rem] text-[var(--accent)]">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : null}

                                                {"qualitySignals" in item ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        <Badge tone="neutral" size="xs">v{item.version}</Badge>
                                                        <Badge tone="neutral" size="xs">reuse {item.qualitySignals.reuseCount}</Badge>
                                                        <Badge tone="neutral" size="xs">briefings {item.qualitySignals.briefingCopyCount}</Badge>
                                                        {item.promotedTo ? <Badge tone="warning" size="xs">Promoted</Badge> : null}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        <Badge tone="neutral" size="xs">used {item.useCount}</Badge>
                                                        {item.lastUsedAt ? <Badge tone="neutral" size="xs">last used {formatDate(item.lastUsedAt)}</Badge> : null}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex shrink-0 flex-col gap-2">
                                                {item.layer === "snapshot" ? (
                                                    <>
                                                        <Button size="sm" onClick={() => {
                                                            onSelectTask(item.taskId);
                                                            onClose();
                                                        }}>
                                                            Open Task
                                                        </Button>
                                                        <Button size="sm" onClick={() => { void openSnapshotDetail(item.taskId); }}>
                                                            {isExpanded ? "Hide Snapshot" : "View Snapshot"}
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button size="sm" onClick={() => { void openPlaybookDetail(item.id); }}>
                                                            {isExpanded ? "Hide Playbook" : "View Playbook"}
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {isExpanded ? (
                                            loadingKey === key ? (
                                                <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[0.76rem] text-[var(--text-3)]">
                                                    Loading…
                                                </div>
                                            ) : failedKey === key ? (
                                                <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[0.76rem] text-[var(--err)]">
                                                    Failed to load detail.
                                                </div>
                                            ) : item.layer === "snapshot" && workflowContentByTaskId[item.taskId] ? (
                                                <WorkflowContentDetail content={workflowContentByTaskId[item.taskId]!} onPromote={() => handlePromoteSnapshot(workflowContentByTaskId[item.taskId]!)} />
                                            ) : item.layer === "playbook" && playbookById[item.id] ? (
                                                <PlaybookDetail playbook={playbookById[item.id]!} onEdit={() => handleEditPlaybook(playbookById[item.id]!)} />
                                            ) : null
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex min-h-0 flex-col overflow-y-auto bg-[var(--surface-2)] p-4">
                        <div className="mb-3 flex flex-col gap-1">
                            <span className="text-[0.9rem] font-semibold text-[var(--text-1)]">
                                {editorMode === "edit" ? "Edit Playbook" : "Create Playbook"}
                            </span>
                            <span className="text-[0.76rem] leading-relaxed text-[var(--text-3)]">
                                {editorMode
                                    ? "Turn a proven workflow into durable, reusable knowledge."
                                    : "Select a snapshot to promote it, or create a playbook from scratch."}
                            </span>
                        </div>

                        {editorMode ? (
                            <div className="flex flex-col gap-3">
                                <div className={editorFieldClass}>
                                    <SectionLabel>Title</SectionLabel>
                                    <Input value={editorDraft.title} onChange={(event) => setEditorDraft((prev) => ({ ...prev, title: event.target.value }))}/>
                                </div>
                                <div className={editorFieldClass}>
                                    <SectionLabel>Status</SectionLabel>
                                    <div className="flex gap-1">
                                        {(["draft", "active", "archived"] as const).map((status) => (
                                            <button
                                                key={status}
                                                type="button"
                                                className={cn(tabButtonClass, editorDraft.status === status
                                                    ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
                                                    : "border-[var(--border)] bg-transparent text-[var(--text-3)] hover:text-[var(--text-2)]")}
                                                onClick={() => setEditorDraft((prev) => ({ ...prev, status }))}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className={editorFieldClass}>
                                    <SectionLabel>When to Use</SectionLabel>
                                    <Textarea rows={3} value={editorDraft.whenToUse} onChange={(event) => setEditorDraft((prev) => ({ ...prev, whenToUse: event.target.value }))}/>
                                </div>
                                <div className={editorFieldClass}>
                                    <SectionLabel>Approach</SectionLabel>
                                    <Textarea rows={4} value={editorDraft.approach} onChange={(event) => setEditorDraft((prev) => ({ ...prev, approach: event.target.value }))}/>
                                </div>
                                <div className={editorFieldClass}>
                                    <SectionLabel>Prerequisites</SectionLabel>
                                    <Textarea rows={4} placeholder="One item per line" value={editorDraft.prerequisites} onChange={(event) => setEditorDraft((prev) => ({ ...prev, prerequisites: event.target.value }))}/>
                                </div>
                                <div className={editorFieldClass}>
                                    <SectionLabel>Key Steps</SectionLabel>
                                    <Textarea rows={5} placeholder="One item per line" value={editorDraft.keySteps} onChange={(event) => setEditorDraft((prev) => ({ ...prev, keySteps: event.target.value }))}/>
                                </div>
                                <div className={editorFieldClass}>
                                    <SectionLabel>Watchouts</SectionLabel>
                                    <Textarea rows={4} placeholder="One item per line" value={editorDraft.watchouts} onChange={(event) => setEditorDraft((prev) => ({ ...prev, watchouts: event.target.value }))}/>
                                </div>
                                <div className={editorFieldClass}>
                                    <SectionLabel>Anti-patterns</SectionLabel>
                                    <Textarea rows={4} placeholder="One item per line" value={editorDraft.antiPatterns} onChange={(event) => setEditorDraft((prev) => ({ ...prev, antiPatterns: event.target.value }))}/>
                                </div>
                                <div className={editorFieldClass}>
                                    <SectionLabel>Common Failure Modes</SectionLabel>
                                    <Textarea rows={4} placeholder="One item per line" value={editorDraft.failureModes} onChange={(event) => setEditorDraft((prev) => ({ ...prev, failureModes: event.target.value }))}/>
                                </div>
                                <div className={editorFieldClass}>
                                    <SectionLabel>Tags</SectionLabel>
                                    <Input placeholder="comma, separated, tags" value={editorDraft.tags} onChange={(event) => setEditorDraft((prev) => ({ ...prev, tags: event.target.value }))}/>
                                </div>
                                {editorDraft.sourceSnapshotIds.length > 0 ? (
                                    <div className={editorFieldClass}>
                                        <SectionLabel>Source Snapshots</SectionLabel>
                                        <div className="flex flex-wrap gap-1">
                                            {editorDraft.sourceSnapshotIds.map((item) => (
                                                <Badge key={item} tone="accent" size="xs">{item}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                                {playbookSaveError ? (
                                    <p className="mt-1 text-[0.75rem] text-red-500">{playbookSaveError}</p>
                                ) : null}
                                <div className="mt-2 flex justify-end gap-2">
                                    <Button size="sm" onClick={() => {
                                        setEditorMode(null);
                                        setEditorDraft(createEmptyEditorDraft());
                                        setPlaybookSaveError(null);
                                    }}>
                                        Cancel
                                    </Button>
                                    <Button size="sm" disabled={!editorDraft.title.trim() || isSavingPlaybook} onClick={() => { void handleSavePlaybook(); }}>
                                        {isSavingPlaybook ? "Saving…" : editorMode === "edit" ? "Update Playbook" : "Publish Playbook"}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-[12px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-[0.8rem] leading-6 text-[var(--text-3)]">
                                Select a snapshot and click <strong>Promote to Playbook</strong>, or open the Playbooks tab and start a new playbook.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
