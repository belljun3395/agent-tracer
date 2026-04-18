import type React from "react";
import { useMemo } from "react";
import type { TimelineEvent } from "@monitor/web-domain";
import { cn } from "../../lib/ui/cn.js";
import { Badge } from "../ui/Badge.js";
import { inspectorHelpText } from "./helpText.js";
import { SectionCard } from "./SectionCard.js";

/**
 * The 14(ish) Claude Code hook entrypoints we care about. Each entry can
 * either:
 *  - match a specific metadata hookName (preferred, exact), OR
 *  - derive "fired" status from event kind + metadata heuristics when the
 *    upstream hook doesn't stamp a hookName tag.
 *
 * See packages/runtime-claude/hooks/*.ts for the source of truth. We intentionally
 * do NOT import from the plugin package — this module must stay under
 * packages/web-app and work even when the plugin isn't installed on the
 * runtime being viewed.
 */
export interface HookCoverageEntry {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly match: (event: TimelineEvent) => boolean;
}

const HOOK_ENTRIES: readonly HookCoverageEntry[] = [
    {
        id: "SessionStart",
        label: "SessionStart",
        description: "Runtime session booted / resumed",
        match: (e) => e.kind === "context.saved"
            && isSessionStartTrigger(metaString(e.metadata, "trigger"))
    },
    {
        id: "UserPromptSubmit",
        label: "UserPromptSubmit",
        description: "Raw user prompt captured before processing",
        match: (e) => e.kind === "user.message"
            && metaString(e.metadata, "captureMode") === "raw"
    },
    {
        id: "PreToolUse",
        label: "PreToolUse",
        description: "Inferred from any observed tool activity (hook emits no event)",
        match: (e) => e.kind === "tool.used"
            || e.kind === "terminal.command"
            || (e.kind === "agent.activity.logged"
                && (metaString(e.metadata, "activityType") === "delegation"
                    || metaString(e.metadata, "activityType") === "mcp_call"))
    },
    {
        id: "PostToolUse/Bash",
        label: "PostToolUse · Bash",
        description: "Terminal command recorded",
        match: (e) => e.kind === "terminal.command"
    },
    {
        id: "PostToolUse/File",
        label: "PostToolUse · File",
        description: "File edit/write recorded",
        match: (e) => e.kind === "tool.used"
            && isFileToolName(metaString(e.metadata, "toolName"))
    },
    {
        id: "PostToolUse/Explore",
        label: "PostToolUse · Explore",
        description: "Exploration tool recorded (Read, Glob, Grep...)",
        match: (e) => e.kind === "tool.used"
            && isExploreToolName(metaString(e.metadata, "toolName"))
    },
    {
        id: "PostToolUse/Agent",
        label: "PostToolUse · Agent",
        description: "Task / subagent coordination recorded",
        match: (e) => e.kind === "agent.activity.logged"
            && metaString(e.metadata, "activityType") === "delegation"
    },
    {
        id: "PostToolUse/Todo",
        label: "PostToolUse · Todo",
        description: "Todo write captured",
        match: (e) => e.kind === "todo.logged"
    },
    {
        id: "PostToolUse/Mcp",
        label: "PostToolUse · Mcp",
        description: "MCP tool call recorded",
        match: (e) => e.kind === "agent.activity.logged"
            && metaString(e.metadata, "activityType") === "mcp_call"
            && e.metadata["failed"] !== true
    },
    {
        id: "PostToolUseFailure",
        label: "PostToolUseFailure",
        description: "Tool failure captured",
        match: (e) => (e.kind === "tool.used" || e.kind === "agent.activity.logged")
            && e.metadata["failed"] === true
    },
    {
        id: "SubagentStart",
        label: "SubagentStart",
        description: "Subagent delegation began",
        match: (e) => e.kind === "action.logged"
            && (typeof e.metadata["childTaskId"] === "string"
                || typeof e.metadata["agentType"] === "string"
                || metaString(e.metadata, "phase") === "subagent-start")
    },
    {
        id: "SubagentStop",
        label: "SubagentStop",
        description: "Subagent delegation finished",
        match: (e) => e.kind === "action.logged"
            && (metaString(e.metadata, "asyncStatus") === "completed"
                || metaString(e.metadata, "phase") === "subagent-stop")
    },
    {
        id: "PreCompact",
        label: "PreCompact",
        description: "Pre-compact snapshot recorded",
        match: (e) => e.kind === "context.saved"
            && metaString(e.metadata, "compactPhase") === "before"
    },
    {
        id: "PostCompact",
        label: "PostCompact",
        description: "Post-compact summary recorded",
        match: (e) => e.kind === "context.saved"
            && metaString(e.metadata, "compactPhase") === "after"
    },
    {
        id: "InstructionsLoaded",
        label: "InstructionsLoaded",
        description: "Instruction bundle loaded",
        match: (e) => e.kind === "instructions.loaded"
    },
    {
        id: "Stop",
        label: "Stop",
        description: "Assistant finished responding",
        match: (e) => e.kind === "assistant.response"
            && metaString(e.metadata, "source") === "claude-plugin"
    },
    {
        id: "SessionEnd",
        label: "SessionEnd",
        description: "Session ended",
        match: (e) => e.kind === "session.ended"
    }
];

function metaString(metadata: Record<string, unknown>, key: string): string | undefined {
    const value = metadata[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

const FILE_TOOL_NAMES = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit", "str_replace_editor"]);
const EXPLORE_TOOL_NAMES = new Set(["Read", "Glob", "Grep", "ListDir", "LS", "Find"]);
const SESSION_START_TRIGGERS = new Set(["startup", "resume", "clear", "compact"]);

function isSessionStartTrigger(trigger: string | undefined): boolean {
    return trigger !== undefined && SESSION_START_TRIGGERS.has(trigger);
}

function isFileToolName(name: string | undefined): boolean {
    return name !== undefined && FILE_TOOL_NAMES.has(name);
}

function isExploreToolName(name: string | undefined): boolean {
    return name !== undefined && EXPLORE_TOOL_NAMES.has(name);
}

export interface HookCoverageRow {
    readonly entry: HookCoverageEntry;
    readonly count: number;
}

/**
 * Pure helper — exposed for unit tests. Given the full task timeline, returns
 * one row per tracked hook with the count of events attributable to it.
 */
export function computeHookCoverage(timeline: readonly TimelineEvent[]): readonly HookCoverageRow[] {
    return HOOK_ENTRIES.map((entry) => {
        let count = 0;
        for (const event of timeline) {
            if (entry.match(event)) count += 1;
        }
        return { entry, count };
    });
}

interface HookCoveragePanelProps {
    readonly timeline: readonly TimelineEvent[];
}

/**
 * Surfaces which of the Claude Code hooks fired for the current task. A quick
 * way to spot missing instrumentation (e.g. the plugin not installed, or a
 * PostToolUse/Agent misconfigured matcher) without trawling the timeline.
 */
export function HookCoveragePanel({ timeline }: HookCoveragePanelProps): React.JSX.Element {
    const rows = useMemo(() => computeHookCoverage(timeline), [timeline]);
    const firedCount = useMemo(() => rows.filter((row) => row.count > 0).length, [rows]);

    return (
      <SectionCard
        title={<span>Hook Coverage <span className="ml-1.5 text-[0.7rem] font-normal normal-case tracking-normal text-[var(--text-3)]">({firedCount}/{rows.length} fired)</span></span>}
        helpText={inspectorHelpText.hookCoverage}
      >
        <ul className="m-0 grid grid-cols-1 gap-1.5 p-0 list-none md:grid-cols-2">
          {rows.map((row) => (
            <li
              key={row.entry.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-[var(--radius-md)] border px-3 py-2 transition-colors",
                row.count > 0
                  ? "border-[color-mix(in_srgb,var(--ok)_18%,var(--border))] bg-[color-mix(in_srgb,var(--ok-bg)_40%,var(--bg-subtle))]"
                  : "border-[var(--border)] bg-[var(--bg-subtle)]"
              )}
              title={row.entry.description}
            >
              <div className="min-w-0">
                <div className="truncate font-mono text-[0.76rem] font-semibold text-[var(--text-1)]">
                  {row.entry.label}
                </div>
                <div className="truncate text-[0.68rem] text-[var(--text-3)]">
                  {row.entry.description}
                </div>
              </div>
              {row.count > 0 ? (
                <Badge tone="success" size="xs">{row.count.toLocaleString()}</Badge>
              ) : (
                <Badge tone="neutral" size="xs">not observed</Badge>
              )}
            </li>
          ))}
        </ul>
      </SectionCard>
    );
}
