import type React from "react";
import { cn } from "../../lib/ui/cn.js";
import type { FileActivityStat } from "@monitor/web-core";
import { formatRelativeTime } from "@monitor/web-core";
import { PanelCard } from "../ui/PanelCard.js";
import { Badge } from "../ui/Badge.js";
import { cardShell, monoText } from "./styles.js";
import { toRelativePath, summarizePath, dirnameLabel, compactRelationLabel } from "./utils.js";
export type FileSortKey = "recent" | "most-active" | "writes-first" | "alpha";
export function sortFileActivity(files: readonly FileActivityStat[], key: FileSortKey): readonly FileActivityStat[] {
    const copy = [...files];
    switch (key) {
        case "recent": return copy.sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt));
        case "most-active": return copy.sort((a, b) => (b.readCount + b.writeCount) - (a.readCount + a.writeCount) || a.path.localeCompare(b.path));
        case "writes-first": return copy.sort((a, b) => b.writeCount - a.writeCount || a.path.localeCompare(b.path));
        case "alpha": return copy.sort((a, b) => a.path.localeCompare(b.path));
    }
}
const FILE_SORT_OPTIONS: ReadonlyArray<{
    readonly key: FileSortKey;
    readonly label: string;
}> = [
    { key: "recent", label: "Recent" },
    { key: "most-active", label: "Most active" },
    { key: "writes-first", label: "Writes first" },
    { key: "alpha", label: "A→Z" }
];
export function FileActivitySection({ files, workspacePath, expanded, sortKey, onToggle, onSortChange }: {
    readonly files: readonly FileActivityStat[];
    readonly workspacePath?: string | undefined;
    readonly expanded: boolean;
    readonly sortKey: FileSortKey;
    readonly onToggle: () => void;
    readonly onSortChange: (key: FileSortKey) => void;
}): React.JSX.Element {
    const writeFiles = files.filter((f) => f.writeCount > 0).length;
    const readOnlyFiles = files.filter((f) => f.writeCount === 0).length;
    return (<PanelCard className={cardShell}>
      <button className="flex w-full items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3.5 text-left" onClick={onToggle} type="button">
        <div>
          <div className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-3)]">File Activity</div>
          <div className="mt-1 text-[0.82rem] text-[var(--text-2)]">
            {files.length === 0
            ? "No file activity recorded yet."
            : `${files.length} files · ${writeFiles} modified · ${readOnlyFiles} read-only`}
          </div>
        </div>
        <span className="text-[0.76rem] font-semibold text-[var(--accent)]">{expanded ? "Hide" : "Show"}</span>
      </button>
      {!expanded && files.length > 0 && (<div className="px-4 py-3.5">
          <div className="flex flex-wrap gap-2">
            {files.slice(0, 4).map((file) => (<Badge key={file.path} tone={file.writeCount > 0 ? "accent" : "neutral"} size="xs" className="max-w-full break-words" title={file.path}>
                {file.writeCount > 0 ? "✎ " : ""}{summarizePath(file.path, workspacePath)}
              </Badge>))}
            {files.length > 4 && (<Badge tone="neutral" size="xs">+{files.length - 4} more</Badge>)}
          </div>
        </div>)}
      {expanded && (<div className="px-4 py-4">
          {files.length === 0 ? (<p className="m-0 text-[0.8rem] text-[var(--text-3)]">No file activity recorded yet.</p>) : (<>
              <div className="mb-3 flex items-center gap-1.5">
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]">Sort</span>
                {FILE_SORT_OPTIONS.map(({ key, label }) => (<button key={key} className={cn("rounded-full px-2.5 py-1 text-[0.72rem] font-semibold transition-colors", sortKey === key
                        ? "bg-[var(--accent-light)] text-[var(--accent)]"
                        : "text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text-2)]")} onClick={() => onSortChange(key)} type="button">
                    {label}
                  </button>))}
              </div>
              <div className="flex flex-col gap-3">
                {files.map((file) => {
                    const total = file.readCount + file.writeCount;
                    const compactBadge = compactRelationLabel(file.compactRelation);
                    return (<div key={file.path} className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <strong className={cn("block min-w-0 break-words text-[0.82rem] text-[var(--text-1)]", monoText)} title={file.path}>
                          {toRelativePath(file.path, workspacePath)}
                        </strong>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {compactBadge && (<Badge tone={compactBadge.tone} size="xs">{compactBadge.label}</Badge>)}
                          {file.writeCount > 0 && (<Badge tone="accent" size="xs">{file.writeCount} write</Badge>)}
                          <Badge tone="neutral" size="xs">{file.readCount > 0 ? `${file.readCount} read` : `${total}x`}</Badge>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap justify-between gap-2 text-[0.8rem] text-[var(--text-3)]">
                        <span>{dirnameLabel(file.path, workspacePath)}</span>
                        <span>
                          {total > 1
                            ? `First ${formatRelativeTime(file.firstSeenAt)} · Last ${formatRelativeTime(file.lastSeenAt)}`
                            : formatRelativeTime(file.lastSeenAt)}
                        </span>
                      </div>
                    </div>);
                })}
              </div>
            </>)}
        </div>)}
    </PanelCard>);
}
