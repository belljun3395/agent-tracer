import type React from "react";
import { useState } from "react";
import { cn } from "../../lib/ui/cn.js";
import { formatRelativeTime, type DirectoryMentionVerification, type ExplorationInsight, type FileMentionVerification, type MentionedFileVerification, type WebLookupStat } from "@monitor/web-domain";
import { Badge } from "../ui/Badge.js";
import { PanelCard } from "../ui/PanelCard.js";
import { FileEvidenceSection, type FileEvidenceSortKey, type FileEvidenceStat } from "./FileEvidenceSection.js";
import { cardShell, cardHeader, cardBody, innerPanel, monoText } from "./styles.js";
import { toRelativePath, summarizePath, compactRelationLabel } from "./utils.js";
function ExplorationInsightCard({ insight }: {
    readonly insight: ExplorationInsight;
}): React.JSX.Element {
    const toolEntries = Object.entries(insight.toolBreakdown).sort((a, b) => b[1] - a[1]);
    return (<PanelCard className={cardShell}>
      <div className={cardHeader}>
        <span>Exploration Overview</span>
      </div>
      <div className={cardBody}>
        {insight.totalExplorations === 0 ? (<p className="m-0 text-[0.8rem] text-[var(--text-3)]">No exploration activity recorded yet.</p>) : (<div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2 max-md:grid-cols-1">
              <div className={innerPanel + " p-3"}>
                <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Total Explorations</span>
                <strong className="mt-2 block text-[1.05rem] text-[var(--text-1)]">{insight.totalExplorations}</strong>
              </div>
              <div className={innerPanel + " p-3"}>
                <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Unique Files</span>
                <strong className="mt-2 block text-[1.05rem] text-[var(--text-1)]">{insight.uniqueFiles}</strong>
              </div>
              <div className={innerPanel + " p-3"}>
                <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Web Lookups</span>
                <strong className="mt-2 block text-[1.05rem] text-[var(--exploration)]">{insight.uniqueWebLookups}</strong>
              </div>
            </div>

            {toolEntries.length > 0 && (<div>
                <div className="mb-2 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Tool Breakdown</div>
                <div className="flex flex-col gap-2">
                  {toolEntries.map(([tool, count]) => (<div key={tool} className="flex items-center justify-between gap-3 rounded-[8px] bg-[var(--surface-2)] px-3 py-2">
                      <span className={cn("min-w-0 break-words text-[0.82rem] text-[var(--text-2)]", monoText)}>{tool}</span>
                      <Badge tone="neutral" size="xs">{count}x</Badge>
                    </div>))}
                </div>
              </div>)}

            {(insight.firstExplorationAt || insight.lastExplorationAt) && (<div className="flex flex-wrap gap-4 text-[0.78rem] text-[var(--text-3)]">
                {insight.firstExplorationAt && (<span>First: {formatRelativeTime(insight.firstExplorationAt)}</span>)}
                {insight.lastExplorationAt && (<span>Last: {formatRelativeTime(insight.lastExplorationAt)}</span>)}
              </div>)}
          </div>)}
      </div>
    </PanelCard>);
}
function WebLookupsCard({ lookups }: {
    readonly lookups: readonly WebLookupStat[];
}): React.JSX.Element {
    return (<PanelCard className={cardShell}>
      <div className={cardHeader}>
        <span>Web Lookups</span>
        <Badge tone="neutral" size="xs">{lookups.length}</Badge>
      </div>
      <div className={cardBody}>
        {lookups.length === 0 ? (<p className="m-0 text-[0.8rem] text-[var(--text-3)]">No web lookups recorded yet.</p>) : (<div className="flex flex-col gap-2">
            {lookups.map((lookup) => (<div key={`${lookup.url}-${lookup.firstSeenAt}`} className="flex items-start justify-between gap-3 rounded-[8px] bg-[var(--surface-2)] px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-[var(--exploration)]">
                      {lookup.toolName}
                    </span>
                    {lookup.count > 1 && (<Badge tone="neutral" size="xs">{lookup.count}x</Badge>)}
                    {compactRelationLabel(lookup.compactRelation) && (<Badge tone={compactRelationLabel(lookup.compactRelation)?.tone ?? "neutral"} size="xs">
                        {compactRelationLabel(lookup.compactRelation)?.label}
                      </Badge>)}
                  </div>
                  <p className={cn("mt-0.5 break-all text-[0.82rem] text-[var(--text-1)]", monoText)}>
                    {lookup.url}
                  </p>
                  <p className="mt-0.5 text-[0.72rem] text-[var(--text-3)]">
                    {formatRelativeTime(lookup.lastSeenAt)}
                  </p>
                </div>
              </div>))}
          </div>)}
      </div>
    </PanelCard>);
}
function FileMentionRow({ v, workspacePath }: {
    readonly v: FileMentionVerification;
    readonly workspacePath?: string | undefined;
}): React.JSX.Element {
    return (<div className={cn("rounded-[12px] border px-4 py-3", v.wasExplored
            ? "border-[var(--border)] bg-[var(--surface-2)]"
            : "border-[color-mix(in_srgb,#f59e0b_30%,transparent)] bg-[color-mix(in_srgb,#f59e0b_5%,var(--surface-2))]")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-[0.72rem] text-[var(--text-3)]">file</span>
          <strong className={cn("block min-w-0 break-words text-[0.82rem] text-[var(--text-1)]", monoText)} title={v.path}>
            {toRelativePath(v.path, workspacePath)}
          </strong>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {v.wasExplored ? (<>
              {!v.exploredAfterMention && (<Badge tone="warning" size="xs">pre-mention</Badge>)}
              <Badge tone="success" size="xs">
                {v.explorationCount > 1 ? `read ${v.explorationCount}x` : "read ✓"}
              </Badge>
            </>) : (<Badge tone="warning" size="xs">not read</Badge>)}
        </div>
      </div>
      <div className="mt-1.5 text-[0.78rem] text-[var(--text-3)]">
        Mentioned {formatRelativeTime(v.mentionedAt)}
        {v.wasExplored && v.firstExploredAt
            ? ` · first read ${formatRelativeTime(v.firstExploredAt)}`
            : !v.wasExplored ? " · not yet explored" : ""}
      </div>
    </div>);
}
function DirectoryMentionRow({ v, workspacePath }: {
    readonly v: DirectoryMentionVerification;
    readonly workspacePath?: string | undefined;
}): React.JSX.Element {
    const [open, setOpen] = useState(false);
    const count = v.exploredFilesInFolder.length;
    return (<div className={cn("rounded-[12px] border px-4 py-3", v.wasExplored
            ? "border-[var(--border)] bg-[var(--surface-2)]"
            : "border-[color-mix(in_srgb,#f59e0b_30%,transparent)] bg-[color-mix(in_srgb,#f59e0b_5%,var(--surface-2))]")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-[0.72rem] text-[var(--text-3)]">dir</span>
          <strong className={cn("block min-w-0 break-words text-[0.82rem] text-[var(--text-1)]", monoText)} title={v.path}>
            {toRelativePath(v.path.replace(/\/$/, ""), workspacePath)}/
          </strong>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {v.wasExplored ? (<>
              {!v.exploredAfterMention && (<Badge tone="warning" size="xs">pre-mention</Badge>)}
              <Badge tone="success" size="xs">{count} file{count !== 1 ? "s" : ""} read</Badge>
            </>) : (<Badge tone="warning" size="xs">none read</Badge>)}
        </div>
      </div>
      <div className="mt-1.5 text-[0.78rem] text-[var(--text-3)]">
        Mentioned {formatRelativeTime(v.mentionedAt)}
        {count > 0 && (<button className="ml-2 text-[var(--accent)] hover:underline" onClick={() => setOpen((c) => !c)} type="button">
            {open ? "hide files" : `show ${count} file${count !== 1 ? "s" : ""}`}
          </button>)}
      </div>
      {open && count > 0 && (<div className="mt-2 flex flex-col gap-1">
          {v.exploredFilesInFolder.map((f) => (<div key={f.path} className="flex items-center justify-between gap-2 rounded-[8px] bg-[var(--surface)] px-3 py-1.5">
              <span className={cn("min-w-0 break-words text-[0.78rem] text-[var(--text-2)]", monoText)} title={f.path}>
                {toRelativePath(f.path, workspacePath)}
              </span>
              <Badge tone="accent" size="xs">{f.count}x</Badge>
            </div>))}
        </div>)}
    </div>);
}
function MentionedFilesVerificationCard({ verifications, workspacePath }: {
    readonly verifications: readonly MentionedFileVerification[];
    readonly workspacePath?: string | undefined;
}): React.JSX.Element {
    const [expanded, setExpanded] = useState(false);
    const unverifiedCount = verifications.filter((v) => !v.wasExplored).length;
    const preCount = verifications.filter((v) => v.wasExplored && !v.exploredAfterMention).length;
    const summaryText = verifications.length === 0
        ? "No @ mentions detected in user messages"
        : `${verifications.length} mentioned · ${unverifiedCount} not read${preCount > 0 ? ` · ${preCount} pre-mention` : ""}`;
    return (<PanelCard className={cardShell}>
      <button className="flex w-full items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3.5 text-left" onClick={() => setExpanded((c) => !c)} type="button">
        <div>
          <div className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-3)]">@ Mentioned Files</div>
          <div className="mt-1 text-[0.82rem] text-[var(--text-2)]">{summaryText}</div>
        </div>
        <span className="text-[0.76rem] font-semibold text-[var(--accent)]">{expanded ? "Hide" : "Show"}</span>
      </button>

      {!expanded && verifications.length > 0 && (<div className="px-4 py-3.5">
          <div className="flex flex-wrap gap-2">
            {verifications.slice(0, 3).map((v) => (<Badge key={`${v.mentionedInEventId}::${v.path}`} tone={v.wasExplored ? "success" : "warning"} size="xs" className="max-w-full break-words" title={v.path}>
                {v.mentionType === "directory" ? "📁 " : ""}{summarizePath(v.path, workspacePath)}
              </Badge>))}
            {verifications.length > 3 && (<Badge tone="neutral" size="xs">+{verifications.length - 3} more</Badge>)}
          </div>
        </div>)}

      {expanded && (<div className="px-4 py-4">
          {verifications.length === 0 ? (<p className="m-0 text-[0.8rem] text-[var(--text-3)]">
              User messages did not contain any @ file or folder references. Mentions are captured from <code className="text-[0.78rem]">@path</code>, backtick paths, and inline path tokens.
            </p>) : (<div className="flex flex-col gap-3">
              {verifications.map((v) => v.mentionType === "directory" ? (<DirectoryMentionRow key={`${v.mentionedInEventId}::${v.path}`} v={v} workspacePath={workspacePath}/>) : (<FileMentionRow key={`${v.mentionedInEventId}::${v.path}`} v={v} workspacePath={workspacePath}/>))}
            </div>)}
        </div>)}
    </PanelCard>);
}
export interface EvidenceTabProps {
    readonly sortedFileEvidence: readonly FileEvidenceStat[];
    readonly workspacePath?: string | undefined;
    readonly isFileEvidenceExpanded: boolean;
    readonly fileEvidenceSortKey: FileEvidenceSortKey;
    readonly explorationInsight: ExplorationInsight;
    readonly webLookups: readonly WebLookupStat[];
    readonly mentionedVerifications: readonly MentionedFileVerification[];
    readonly onToggleFileEvidence: () => void;
    readonly onFileEvidenceSortChange: (key: FileEvidenceSortKey) => void;
}
export function EvidenceTab({ sortedFileEvidence, workspacePath, isFileEvidenceExpanded, fileEvidenceSortKey, explorationInsight, webLookups, mentionedVerifications, onToggleFileEvidence, onFileEvidenceSortChange }: EvidenceTabProps): React.JSX.Element {
    return (<div className="panel-tab-inner flex flex-col gap-5 p-4">
      <ExplorationInsightCard insight={explorationInsight}/>
      <FileEvidenceSection files={sortedFileEvidence} workspacePath={workspacePath} expanded={isFileEvidenceExpanded} sortKey={fileEvidenceSortKey} onToggle={onToggleFileEvidence} onSortChange={onFileEvidenceSortChange}/>
      <WebLookupsCard lookups={webLookups}/>
      <MentionedFilesVerificationCard verifications={mentionedVerifications} workspacePath={workspacePath}/>
    </div>);
}
