import type React from "react";
import { cn } from "../../lib/ui/cn.js";
import { formatRelativeTime, type CompactRelation, type ExploredFileStat, type FileActivityStat } from "@monitor/web-domain";
import { PanelCard } from "../ui/PanelCard.js";
import { Badge } from "../ui/Badge.js";
import { cardShell, monoText } from "./styles.js";
import { compactRelationLabel, dirnameLabel, summarizePath, toRelativePath } from "./utils.js";

export interface FileEvidenceStat {
    readonly path: string;
    readonly readCount: number;
    readonly writeCount: number;
    readonly explorationCount: number;
    readonly firstSeenAt: string;
    readonly lastSeenAt: string;
    readonly compactRelation: CompactRelation;
}

export type FileEvidenceSortKey = "recent" | "most-active" | "writes-first" | "most-explored" | "alpha";

const FILE_EVIDENCE_SORT_OPTIONS: ReadonlyArray<{
    readonly key: FileEvidenceSortKey;
    readonly label: string;
}> = [
    { key: "recent", label: "Recent" },
    { key: "most-active", label: "Most active" },
    { key: "writes-first", label: "Writes first" },
    { key: "most-explored", label: "Most explored" },
    { key: "alpha", label: "A→Z" }
];

function mergeCompactRelation(left: CompactRelation, right: CompactRelation): CompactRelation {
    if (left === right) {
        return left;
    }
    if (left === "across-compact" || right === "across-compact") {
        return "across-compact";
    }
    if (left === "no-compact") {
        return right;
    }
    if (right === "no-compact") {
        return left;
    }
    return "across-compact";
}

function minTimestamp(left: string, right: string): string {
    return Date.parse(left) <= Date.parse(right) ? left : right;
}

function maxTimestamp(left: string, right: string): string {
    return Date.parse(left) >= Date.parse(right) ? left : right;
}

export function buildFileEvidenceRows(fileActivity: readonly FileActivityStat[], exploredFiles: readonly ExploredFileStat[]): readonly FileEvidenceStat[] {
    const byPath = new Map<string, FileEvidenceStat>();

    for (const file of fileActivity) {
        byPath.set(file.path, {
            path: file.path,
            readCount: file.readCount,
            writeCount: file.writeCount,
            explorationCount: 0,
            firstSeenAt: file.firstSeenAt,
            lastSeenAt: file.lastSeenAt,
            compactRelation: file.compactRelation
        });
    }

    for (const file of exploredFiles) {
        const existing = byPath.get(file.path);
        if (!existing) {
            byPath.set(file.path, {
                path: file.path,
                readCount: 0,
                writeCount: 0,
                explorationCount: file.count,
                firstSeenAt: file.firstSeenAt,
                lastSeenAt: file.lastSeenAt,
                compactRelation: file.compactRelation
            });
            continue;
        }
        byPath.set(file.path, {
            ...existing,
            explorationCount: existing.explorationCount + file.count,
            firstSeenAt: minTimestamp(existing.firstSeenAt, file.firstSeenAt),
            lastSeenAt: maxTimestamp(existing.lastSeenAt, file.lastSeenAt),
            compactRelation: mergeCompactRelation(existing.compactRelation, file.compactRelation)
        });
    }

    return [...byPath.values()];
}

export function sortFileEvidenceRows(files: readonly FileEvidenceStat[], key: FileEvidenceSortKey): readonly FileEvidenceStat[] {
    const copy = [...files];
    const totalActivity = (file: FileEvidenceStat): number => file.readCount + file.writeCount + file.explorationCount;
    switch (key) {
        case "recent":
            return copy.sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt));
        case "most-active":
            return copy.sort((a, b) => totalActivity(b) - totalActivity(a) || a.path.localeCompare(b.path));
        case "writes-first":
            return copy.sort((a, b) => b.writeCount - a.writeCount || totalActivity(b) - totalActivity(a) || a.path.localeCompare(b.path));
        case "most-explored":
            return copy.sort((a, b) => b.explorationCount - a.explorationCount || totalActivity(b) - totalActivity(a) || a.path.localeCompare(b.path));
        case "alpha":
            return copy.sort((a, b) => a.path.localeCompare(b.path));
    }
}

export function FileEvidenceSection({ files, workspacePath, expanded, sortKey, onToggle, onSortChange }: {
    readonly files: readonly FileEvidenceStat[];
    readonly workspacePath?: string | undefined;
    readonly expanded: boolean;
    readonly sortKey: FileEvidenceSortKey;
    readonly onToggle: () => void;
    readonly onSortChange: (key: FileEvidenceSortKey) => void;
}): React.JSX.Element {
    const modifiedCount = files.filter((file) => file.writeCount > 0).length;
    const explorationOnlyCount = files.filter((file) => file.explorationCount > 0 && file.readCount === 0 && file.writeCount === 0).length;

    return (
        <PanelCard className={cardShell}>
            <button className="flex w-full items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3.5 text-left" onClick={onToggle} type="button">
                <div>
                    <div className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-3)]">Files</div>
                    <div className="mt-1 text-[0.82rem] text-[var(--text-2)]">
                        {files.length === 0
                            ? "No file evidence recorded yet."
                            : `${files.length} files · ${modifiedCount} modified${explorationOnlyCount > 0 ? ` · ${explorationOnlyCount} exploration-only` : ""}`}
                    </div>
                </div>
                <span className="text-[0.76rem] font-semibold text-[var(--accent)]">{expanded ? "Hide" : "Show"}</span>
            </button>

            {!expanded && files.length > 0 && (
                <div className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-2">
                        {files.slice(0, 4).map((file) => (
                            <Badge key={file.path} tone={file.writeCount > 0 ? "accent" : file.explorationCount > 0 ? "success" : "neutral"} size="xs" className="max-w-full break-words" title={file.path}>
                                {summarizePath(file.path, workspacePath)}
                            </Badge>
                        ))}
                        {files.length > 4 && <Badge tone="neutral" size="xs">+{files.length - 4} more</Badge>}
                    </div>
                </div>
            )}

            {expanded && (
                <div className="px-4 py-4">
                    {files.length === 0 ? (
                        <p className="m-0 text-[0.8rem] text-[var(--text-3)]">No file evidence recorded yet.</p>
                    ) : (
                        <>
                            <div className="mb-3 flex items-center gap-1.5">
                                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]">Sort</span>
                                {FILE_EVIDENCE_SORT_OPTIONS.map(({ key, label }) => (
                                    <button key={key} className={cn("rounded-full px-2.5 py-1 text-[0.72rem] font-semibold transition-colors", sortKey === key
                                        ? "bg-[var(--accent-light)] text-[var(--accent)]"
                                        : "text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text-2)]")} onClick={() => onSortChange(key)} type="button">
                                        {label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex flex-col gap-3">
                                {files.map((file) => {
                                    const compactBadge = compactRelationLabel(file.compactRelation);
                                    const totalActivity = file.readCount + file.writeCount + file.explorationCount;

                                    return (
                                        <div key={file.path} className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <strong className={cn("block min-w-0 break-words text-[0.82rem] text-[var(--text-1)]", monoText)} title={file.path}>
                                                    {toRelativePath(file.path, workspacePath)}
                                                </strong>
                                                <div className="flex shrink-0 items-center gap-1.5">
                                                    {compactBadge && <Badge tone={compactBadge.tone} size="xs">{compactBadge.label}</Badge>}
                                                    {file.explorationCount > 0 && <Badge tone="success" size="xs">{file.explorationCount} explore</Badge>}
                                                    {file.writeCount > 0 && <Badge tone="accent" size="xs">{file.writeCount} write</Badge>}
                                                    {file.readCount > 0 && <Badge tone="neutral" size="xs">{file.readCount} read</Badge>}
                                                    {totalActivity === 0 && <Badge tone="neutral" size="xs">0 activity</Badge>}
                                                </div>
                                            </div>
                                            <div className="mt-2 flex flex-wrap justify-between gap-2 text-[0.8rem] text-[var(--text-3)]">
                                                <span>{dirnameLabel(file.path, workspacePath)}</span>
                                                <span>
                                                    {totalActivity > 1
                                                        ? `First ${formatRelativeTime(file.firstSeenAt)} · Last ${formatRelativeTime(file.lastSeenAt)}`
                                                        : formatRelativeTime(file.lastSeenAt)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}
        </PanelCard>
    );
}
