import type React from "react";
import type { WorkflowContentRecord, PlaybookRecordResponse } from "@monitor/web-io";
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
    readonly onOpenSnapshotDetail: (snapshotId: string, taskId: string, scopeKey: string) => void;
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

    const key = item.layer === "snapshot" ? `snapshot:${item.snapshotId}` : `playbook:${item.id}`;
    const isExpanded = expandedKey === key;

    return (
        <div className="border-b border-[var(--border)] last:border-0">
            <div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-2)]">
                <div className="min-w-0 flex flex-1 flex-col gap-2">
                    <div className="flex items-start gap-2">
                        <Badge tone={item.layer === "playbook" ? "warning" : "accent"} size="xs">
                            {item.layer === "playbook" ? "Playbook" : "Snapshot"}
                        </Badge>
                        {item.layer === "snapshot" ? (
                            <span className={cn("mt-0.5 shrink-0 rounded-[var(--radius-md)] px-2 py-0.5 text-[0.63rem] font-semibold", item.rating === "good"
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
                            <span className="truncate text-[0.8rem] font-semibold text-[var(--text-1)]">
                                {item.layer === "snapshot" ? (item.displayTitle ?? item.title) : item.title}
                            </span>
                            {item.layer === "snapshot" ? (
                                item.useCase ? <span className="text-[0.74rem] text-[var(--text-2)]">{item.useCase}</span> : null
                            ) : (
                                item.whenToUse ? <span className="text-[0.74rem] text-[var(--text-2)]">{item.whenToUse}</span> : null
                            )}
                        </div>
                        <span className="shrink-0 text-[0.66rem] text-[var(--text-3)]">
                            {item.layer === "snapshot" ? formatDate(item.evaluatedAt) : formatDate(item.updatedAt)}
                        </span>
                    </div>

                    {"workflowTags" in item && item.workflowTags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {item.workflowTags.map((tag) => (
                                <span key={tag} className="rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 text-[0.64rem] text-[var(--accent)]">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    ) : "tags" in item && item.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {item.tags.map((tag) => (
                                <span key={tag} className="rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 text-[0.64rem] text-[var(--accent)]">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    ) : null}

                    {"qualitySignals" in item ? (
                        <div className="flex flex-wrap gap-1">
                            {item.scopeKind === "turn" ? <Badge tone="neutral" size="xs">{item.scopeLabel}</Badge> : null}
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

                    <div className="flex shrink-0 items-center gap-1.5">
                    {item.layer === "snapshot" ? (
                        <>
                            <Button size="icon" title="Open task" variant="bare" className="h-7 w-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] hover:border-[var(--border-strong)] hover:bg-[var(--surface)] hover:text-[var(--text-1)]" onClick={() => { onSelectTask(item.taskId); }}>
                                <svg fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="13"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
                            </Button>
                            <Button size="sm" variant={isExpanded ? "accent" : "ghost"} onClick={() => { onOpenSnapshotDetail(item.snapshotId, item.taskId, item.scopeKey); }}>
                                {isExpanded ? "Close" : "Detail"}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button size="sm" variant={isExpanded ? "accent" : "ghost"} onClick={() => { onOpenPlaybookDetail(item.id); }}>
                                {isExpanded ? "Close" : "Detail"}
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
                ) : item.layer === "snapshot" && workflowContentByTaskId[item.snapshotId] ? (
                    <SnapshotDetail
                        content={workflowContentByTaskId[item.snapshotId]!}
                        onPromote={() => { onPromoteSnapshot(workflowContentByTaskId[item.snapshotId]!); }}
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
