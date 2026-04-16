import type React from "react";
import { useState } from "react";
import { formatCount, formatDuration } from "@monitor/web-core";
import { buildResumeCommand } from "@monitor/web-core";
import { copyToClipboard } from "../../lib/ui/clipboard.js";
import { cn } from "../../lib/ui/cn.js";
import { Eyebrow } from "../ui/Eyebrow.js";
import { PanelCard } from "../ui/PanelCard.js";
import { SectionCard } from "./SectionCard.js";
import { ObservabilityMetricGrid, ObservabilityList, ObservabilityPhaseBreakdown } from "./ObservabilitySection.js";
import { cardShell, cardHeader, cardBody, innerPanel } from "./styles.js";
import { toRelativePath } from "./utils.js";
import type { SubagentInsight, VerificationCycleItem } from "@monitor/web-core";
import type { TaskObservabilityResponse } from "@monitor/web-core";
function RuntimeSessionCard({ runtimeSessionId, runtimeSource }: {
    readonly runtimeSessionId?: string | undefined;
    readonly runtimeSource?: string | undefined;
}): React.JSX.Element | null {
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
    if (!runtimeSessionId)
        return null;
    const spec = buildResumeCommand(runtimeSource, runtimeSessionId);
    const handleCopy = (text: string): void => {
        void copyToClipboard(text).then((copied) => {
            setCopyStatus(copied ? "copied" : "failed");
            window.setTimeout(() => setCopyStatus("idle"), 1600);
        });
    };
    return (<SectionCard title={<span>Runtime Session{spec ? ` · ${spec.label}` : ""}</span>} action={spec ? (<button type="button" onClick={() => handleCopy(spec.command)} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[0.72rem] font-medium text-[var(--text-2)] shadow-[var(--shadow-1)] transition-[background-color,border-color,color] duration-200 hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]">
          {copyStatus === "idle" ? "Copy command" : copyStatus === "copied" ? "Copied" : "Copy failed"}
        </button>) : undefined}>
      <div className={innerPanel + " p-3"}>
        <Eyebrow className="block">Session ID</Eyebrow>
        <code className="mt-1 block break-all font-mono text-[0.8rem] text-[var(--text-1)]">{runtimeSessionId}</code>
      </div>
      {spec ? (<div className={innerPanel + " mt-2 p-3"}>
          <Eyebrow className="block">Resume command</Eyebrow>
          <code className="mt-1 block break-all font-mono text-[0.8rem] text-[var(--text-1)]">{spec.command}</code>
        </div>) : (<p className="m-0 text-[0.78rem] text-[var(--text-3)]">
          Unknown runtime source ({runtimeSource ?? "n/a"}) — copy the session ID and resume manually.
        </p>)}
    </SectionCard>);
}
function SubagentInsightCard({ insight }: {
    readonly insight: SubagentInsight;
}): React.JSX.Element {
    return (<PanelCard className={cardShell}>
      <div className={cardHeader}>
        <span>Subagents & Background</span>
      </div>
      <div className={cardBody}>
        {insight.delegations === 0 && insight.backgroundTransitions === 0 ? (<p className="m-0 text-[0.8rem] text-[var(--text-3)]">No subagent or background activity recorded yet.</p>) : (<div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
            <div className={innerPanel + " p-3"}>
              <Eyebrow className="block">Delegations</Eyebrow>
              <strong className="mt-2 block text-[1.05rem] text-[var(--coordination)]">{insight.delegations}</strong>
            </div>
            <div className={innerPanel + " p-3"}>
              <Eyebrow className="block">Background Events</Eyebrow>
              <strong className="mt-2 block text-[1.05rem] text-[var(--text-1)]">{insight.backgroundTransitions}</strong>
              <p className="mt-1 mb-0 text-[0.74rem] text-[var(--text-3)]">{insight.linkedBackgroundEvents} linked to parent context</p>
            </div>
            <div className={innerPanel + " p-3"}>
              <Eyebrow className="block">Async Tasks</Eyebrow>
              <strong className="mt-2 block text-[1.05rem] text-[var(--text-1)]">{insight.uniqueAsyncTasks}</strong>
              <p className="mt-1 mb-0 text-[0.74rem] text-[var(--text-3)]">
                {insight.completedAsyncTasks} completed · {insight.unresolvedAsyncTasks} unresolved
              </p>
            </div>
          </div>)}
      </div>
    </PanelCard>);
}
function VerificationCyclesCard({ items }: {
    readonly items: readonly VerificationCycleItem[];
}): React.JSX.Element | null {
    if (items.length === 0) return null;
    return (<SectionCard title="Verification Cycles">
      <div className="flex flex-col divide-y divide-[var(--border)]">
        {items.map((item) => (<div key={item.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
            <span className={cn(
                "mt-0.5 shrink-0 rounded-[var(--radius-sm)] px-1.5 py-0.5 font-mono text-[0.62rem] font-bold uppercase tracking-wider",
                item.status === "pass"
                    ? "bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] text-[var(--ok)]"
                    : "bg-[color-mix(in_srgb,var(--err)_12%,transparent)] text-[var(--err)]"
            )}>
              {item.status === "pass" ? "Pass" : "Issue"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-[0.78rem] text-[var(--text-1)]">{item.title}</p>
              {item.ruleId && <p className="mt-0.5 m-0 font-mono text-[0.68rem] text-[var(--text-3)]">{item.ruleId}</p>}
            </div>
          </div>))}
      </div>
    </SectionCard>);
}
export interface OverviewTabProps {
    readonly observability: TaskObservabilityResponse["observability"] | null;
    readonly subagentInsight: SubagentInsight;
    readonly verificationCycles?: readonly VerificationCycleItem[];
    readonly runtimeSessionId?: string | undefined;
    readonly runtimeSource?: string | undefined;
    readonly workspacePath?: string | undefined;
}
export function OverviewTab({ observability, subagentInsight, verificationCycles, runtimeSessionId, runtimeSource, workspacePath }: OverviewTabProps): React.JSX.Element {
    return (<div className="panel-tab-inner flex flex-col gap-5 p-4">
      <RuntimeSessionCard runtimeSessionId={runtimeSessionId} runtimeSource={runtimeSource}/>
      {observability ? (<>
          <SectionCard title="Task Flow">
            <ObservabilityMetricGrid items={[
                {
                    label: "Total Duration",
                    value: formatDuration(observability.totalDurationMs),
                    ...(observability.runtimeSource ? { note: `runtime ${observability.runtimeSource}` } : {}),
                    tone: "accent"
                },
                {
                    label: "Active Duration",
                    value: formatDuration(observability.activeDurationMs),
                    note: "work in motion",
                    tone: "ok"
                },
                {
                    label: "Events",
                    value: formatCount(observability.totalEvents),
                    note: "timeline entries"
                },
                {
                    label: "Sessions",
                    value: formatCount(observability.sessions.total),
                    note: `${formatCount(observability.sessions.resumed)} resumed · ${formatCount(observability.sessions.open)} open`
                }
            ]}/>
          </SectionCard>

          <SectionCard title="Signals">
            <ObservabilityMetricGrid items={[
                { label: "Raw Prompts", value: formatCount(observability.signals.rawUserMessages), note: "captured user turns" },
                { label: "Follow-ups", value: formatCount(observability.signals.followUpMessages), note: "additional user turns" },
                { label: "Thoughts", value: formatCount(observability.signals.thoughts), note: "planning summaries" },
                { label: "Tool Calls", value: formatCount(observability.signals.toolCalls), note: "non-terminal tools" },
                { label: "Terminal", value: formatCount(observability.signals.terminalCommands), note: "shell commands" },
                { label: "Verifications", value: formatCount(observability.signals.verifications), note: "tests and checks" },
                { label: "Coordination", value: formatCount(observability.signals.coordinationActivities), note: "MCP / delegation" },
                { label: "Background", value: formatCount(observability.signals.backgroundTransitions), note: "async task transitions" },
                { label: "Explored Files", value: formatCount(observability.signals.exploredFiles), note: "read paths" }
            ]}/>
          </SectionCard>

          <SubagentInsightCard insight={subagentInsight}/>

          {verificationCycles && verificationCycles.length > 0 && (<VerificationCyclesCard items={verificationCycles}/>)}

          <SectionCard title="Phase Breakdown">
            <ObservabilityPhaseBreakdown phases={observability.phaseBreakdown}/>
          </SectionCard>

          <SectionCard title="Top Files">
            <ObservabilityList emptyLabel="No file focus recorded yet." items={observability.focus.topFiles.map((file) => ({
                label: toRelativePath(file.path, workspacePath),
                value: `${formatCount(file.count)}x`
            }))}/>
          </SectionCard>

          <SectionCard title="Top Tags">
            <ObservabilityList emptyLabel="No focus tags recorded yet." items={observability.focus.topTags.map((tag) => ({
                label: tag.tag,
                value: `${formatCount(tag.count)}x`
            }))}/>
          </SectionCard>
        </>) : (<div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-6 text-center">
          <p className="m-0 text-[0.86rem] font-medium text-[var(--text-2)]">No workspace overview available.</p>
          <p className="mt-1.5 mb-0 text-[0.78rem] text-[var(--text-3)]">
            The server will populate this tab once `/api/tasks/:taskId/observability` is available for the selected task.
          </p>
        </div>)}
    </div>);
}
