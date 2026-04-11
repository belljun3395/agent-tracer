import type React from "react";
import type { WorkflowContentRecord, PlaybookRecordResponse } from "@monitor/web-core";
import { cn } from "../../lib/ui/cn.js";
import { Badge } from "../ui/Badge.js";
import { Button } from "../ui/Button.js";
import { formatDate } from "./helpers.js";
import type { KnowledgeItem } from "./helpers.js";
import { SnapshotDetail } from "./SnapshotDetail.js";
import { PlaybookDetailView } from "./PlaybookDetailView.js";

interface KnowledgeItemRowProps {
    readonly item: KnowledgeItem;
    readonly expandedKey: string | null;
    readonly loadingKey: string | null;
    readonly failedKey: string | null;
    readonly workflowContentByTaskId: Record<string, WorkflowContentRecord>;
    readonly playbookById: Record<string, PlaybookRecordResponse>;
    readonly onOpenSnapshotDetail: (taskId: string) => void;
    readonly onOpenPlaybookDetail: (playbookId: string) => void;
    readonly onSelectTask: (taskId: string) => void;
    readonly onPromoteSnapshot: (content: WorkflowContentRecord) => void;
    readonly onEditPlaybook: (playbook: PlaybookRecordResponse) => void;
}

export function KnowledgeItemRow(props: KnowledgeItemRowProps): React.JSX.Element {
    const {
        item,
        expandedKey,
        loadingKey,
        failedKey,
        workflowContentByTaskId,
        playbookById,
        onOpenSnapshotDetail,
        onOpenPlaybookDetail,
        onSelectTask,
        onPromoteSnapshot,
        onEditPlaybook
    } = props;

    const key = item.layer === "snapshot" ? `snapshot:${item.taskId}` : `playbook:${item.id}`;
    const isExpanded = expandedKey === key;

    return (
        <div className="border-b border-[var(--border)] last:border-0">
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
                            <Button size="sm" onClick={() => { onSelectTask(item.taskId); }}>
                                Open Task
                            </Button>
                            <Button size="sm" onClick={() => { onOpenSnapshotDetail(item.taskId); }}>
                                {isExpanded ? "Hide Snapshot" : "View Snapshot"}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button size="sm" onClick={() => { onOpenPlaybookDetail(item.id); }}>
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
                    <SnapshotDetail
                        content={workflowContentByTaskId[item.taskId]!}
                        onPromote={() => { onPromoteSnapshot(workflowContentByTaskId[item.taskId]!); }}
                    />
                ) : item.layer === "playbook" && playbookById[item.id] ? (
                    <PlaybookDetailView
                        playbook={playbookById[item.id]!}
                        onEdit={() => { onEditPlaybook(playbookById[item.id]!); }}
                    />
                ) : null
            ) : null}
        </div>
    );
}
