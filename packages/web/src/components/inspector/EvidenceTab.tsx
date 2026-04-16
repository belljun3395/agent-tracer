import type React from "react";
import { useMemo, useState } from "react";
import { cn } from "../../lib/ui/cn.js";
import { formatRelativeTime, type DirectoryMentionVerification, type ExplorationInsight, type ExploredFileStat, type FileActivityStat, type FileMentionVerification, type MentionedFileVerification, type TagInsight, type WebLookupStat } from "@monitor/web-domain";
import { Badge } from "../ui/Badge.js";
import { Button } from "../ui/Button.js";
import { PanelCard } from "../ui/PanelCard.js";
import { FileActivitySection } from "./FileActivitySection.js";
import { ExploredFilesSection } from "./ExploredFilesSection.js";
import { cardShell, cardHeader, cardBody, innerPanel, monoText } from "./styles.js";
import { toRelativePath, summarizePath, compactRelationLabel } from "./utils.js";
import type { FileSortKey } from "./FileActivitySection.js";
import type { ExplorationSortKey } from "./ExploredFilesSection.js";
function SectionTitle({ eyebrow, title, description, action }: {
    readonly eyebrow?: string;
    readonly title: string;
    readonly description?: string;
    readonly action?: React.ReactNode;
}): React.JSX.Element {
    return (<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (<div className="mb-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[var(--text-3)]">{eyebrow}</div>)}
        <strong className="text-[0.95rem] text-[var(--text-1)]">{title}</strong>
        {description && (<p className="mt-0.5 mb-0 text-[0.78rem] text-[var(--text-3)]">{description}</p>)}
      </div>
      {action ? <div className="min-w-0 sm:shrink-0">{action}</div> : null}
    </div>);
}
function TagExplorerCard({ tags, selectedTag, onSelectTag }: {
    readonly tags: readonly TagInsight[];
    readonly selectedTag: string | null;
    readonly onSelectTag: (tag: string) => void;
}): React.JSX.Element {
    const [isExpanded, setIsExpanded] = useState(false);
    const collapsedLimit = 12;
    const selectedInsight = selectedTag
        ? tags.find((tag) => tag.tag === selectedTag) ?? null
        : null;
    const visibleTags = useMemo(() => {
        if (isExpanded || tags.length <= collapsedLimit) {
            return tags;
        }
        const initial = tags.slice(0, collapsedLimit);
        if (!selectedTag || initial.some((tag) => tag.tag === selectedTag)) {
            return initial;
        }
        const selected = tags.find((tag) => tag.tag === selectedTag);
        return selected ? [...initial.slice(0, collapsedLimit - 1), selected] : initial;
    }, [isExpanded, selectedTag, tags]);
    const hiddenCount = Math.max(tags.length - visibleTags.length, 0);
    return (<PanelCard className={cardShell}>
      <div className={cardBody}>
        <SectionTitle action={(selectedTag || tags.length > collapsedLimit) ? (<div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {tags.length > collapsedLimit && (<Button className="h-8 whitespace-nowrap rounded-[var(--radius-md)] px-3 text-[0.72rem] font-semibold shadow-none" onClick={() => setIsExpanded((current) => !current)} size="sm" type="button" variant="bare">
                  {isExpanded ? "Show top" : `Show all ${tags.length}`}
                </Button>)}
              {selectedTag && (<Button className="h-8 whitespace-nowrap rounded-[var(--radius-md)] px-3 text-[0.72rem] font-semibold shadow-none" onClick={() => onSelectTag(selectedTag)} size="sm" type="button" variant="bare">
                  Clear
                </Button>)}
            </div>) : undefined} description={`${tags.length} distinct tags across the selected task`} eyebrow="Tags" title="Tag Explorer"/>
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.length === 0 ? (<p className="m-0 text-[0.8rem] text-[var(--text-3)]">No tags observed yet.</p>) : (visibleTags.map((tag) => (<Button key={tag.tag} className={cn("h-auto rounded-full border px-3.5 py-1.5 text-[0.78rem] font-semibold shadow-none", selectedTag === tag.tag
                ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]"
                : "border-[var(--border)] bg-[var(--bg)] text-[var(--text-2)] hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]")} onClick={() => onSelectTag(tag.tag)} size="sm" type="button" variant="bare">
                <span className="font-mono">{tag.tag}</span>
                <span className="ml-2 rounded-full bg-[var(--surface)] px-2 py-0.5 text-[0.7rem] font-semibold text-[var(--text-3)]">{tag.count}</span>
              </Button>)))}
        </div>
        {visibleTags.length > 0 && visibleTags.length !== tags.length && (<p className="mt-3 mb-0 text-[0.76rem] text-[var(--text-3)]">
            Showing top {visibleTags.length} tags by frequency{hiddenCount > 0 ? ` · ${hiddenCount} more hidden` : ""}
          </p>)}
        <div className="mt-4 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] p-4">
          {selectedInsight ? (<>
              <div className="flex items-center justify-between gap-3">
                <strong className="font-mono text-[0.9rem] text-[var(--text-1)]">{selectedInsight.tag}</strong>
                <Badge tone="accent" size="xs">{selectedInsight.count} events</Badge>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Lanes</div>
                  <div className="mt-1 text-[0.82rem] text-[var(--text-2)]">{selectedInsight.lanes.join(" · ")}</div>
                </div>
                <div>
                  <div className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Rules</div>
                  <div className="mt-1 text-[0.82rem] text-[var(--text-2)]">
                    {selectedInsight.ruleIds.length > 0 ? selectedInsight.ruleIds.join(", ") : "No linked rule"}
                  </div>
                </div>
              </div>
            </>) : (<p className="m-0 text-[0.8rem] text-[var(--text-3)]">
              Pick a tag chip to focus the timeline and inspect where that signal appears.
            </p>)}
        </div>
      </div>
    </PanelCard>);
}
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
    readonly tagInsights: readonly TagInsight[];
    readonly selectedTag: string | null;
    readonly sortedFileActivity: readonly FileActivityStat[];
    readonly workspacePath?: string | undefined;
    readonly isFileActivityExpanded: boolean;
    readonly fileSortKey: FileSortKey;
    readonly explorationInsight: ExplorationInsight;
    readonly webLookups: readonly WebLookupStat[];
    readonly sortedExploredFiles: readonly ExploredFileStat[];
    readonly isExploredFilesExpanded: boolean;
    readonly explorationSortKey: ExplorationSortKey;
    readonly mentionedVerifications: readonly MentionedFileVerification[];
    readonly onSelectTag: (tag: string) => void;
    readonly onToggleFileActivity: () => void;
    readonly onFileSortChange: (key: FileSortKey) => void;
    readonly onToggleExploredFiles: () => void;
    readonly onExplorationSortChange: (key: ExplorationSortKey) => void;
}
export function EvidenceTab({ tagInsights, selectedTag, sortedFileActivity, workspacePath, isFileActivityExpanded, fileSortKey, explorationInsight, webLookups, sortedExploredFiles, isExploredFilesExpanded, explorationSortKey, mentionedVerifications, onSelectTag, onToggleFileActivity, onFileSortChange, onToggleExploredFiles, onExplorationSortChange }: EvidenceTabProps): React.JSX.Element {
    return (<div className="panel-tab-inner flex flex-col gap-5 p-4">
      <TagExplorerCard tags={tagInsights} selectedTag={selectedTag} onSelectTag={onSelectTag}/>
      <FileActivitySection files={sortedFileActivity} workspacePath={workspacePath} expanded={isFileActivityExpanded} sortKey={fileSortKey} onToggle={onToggleFileActivity} onSortChange={onFileSortChange}/>
      <ExplorationInsightCard insight={explorationInsight}/>
      <WebLookupsCard lookups={webLookups}/>
      <ExploredFilesSection files={sortedExploredFiles} workspacePath={workspacePath} expanded={isExploredFilesExpanded} sortKey={explorationSortKey} onToggle={onToggleExploredFiles} onSortChange={onExplorationSortChange}/>
      <MentionedFilesVerificationCard verifications={mentionedVerifications} workspacePath={workspacePath}/>
    </div>);
}
