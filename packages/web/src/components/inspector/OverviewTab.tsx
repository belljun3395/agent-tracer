import type React from "react";
import { formatCount, formatDuration } from "@monitor/web-core";
import { buildResumeCommand } from "@monitor/web-core";
import { copyToClipboard } from "../../lib/ui/clipboard.js";
import { Eyebrow } from "../ui/Eyebrow.js";
import { PanelCard } from "../ui/PanelCard.js";
import { SectionCard } from "./SectionCard.js";
import { ObservabilityMetricGrid, ObservabilityList, ObservabilityPhaseBreakdown } from "./ObservabilitySection.js";
import { cardShell, cardHeader, cardBody, innerPanel } from "./styles.js";
import type { SubagentInsight } from "@monitor/web-core";
import type { TaskObservabilityResponse } from "@monitor/web-core";
function RuntimeSessionCard({ runtimeSessionId, runtimeSource }: {
    readonly runtimeSessionId?: string | undefined;
    readonly runtimeSource?: string | undefined;
}): React.JSX.Element | null {
    if (!runtimeSessionId)
        return null;
    const spec = buildResumeCommand(runtimeSource, runtimeSessionId);
    const handleCopy = (text: string): void => {
        void copyToClipboard(text);
    };
    return (<SectionCard title={<span>Runtime Session{spec ? ` · ${spec.label}` : ""}</span>} action={spec ? (<button type="button" onClick={() => handleCopy(spec.command)} className="rounded-md border border-[var(--border)] px-2 py-1 text-[0.72rem] text-[var(--text-2)] hover:bg-[var(--surface-2)]">
          Copy command
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
        {insight.delegations === 0 && insight.backgroundTransitions === 0 ? (<p className="m-0 text-[0.8rem] text-[var(--text-3)]">No subagent or background activity recorded yet.</p>) : (<div className="grid grid-cols-3 gap-2 max-md:grid-cols-1">
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
export interface OverviewTabProps {
    readonly observability: TaskObservabilityResponse["observability"] | null;
    readonly subagentInsight: SubagentInsight;
    readonly runtimeSessionId?: string | undefined;
    readonly runtimeSource?: string | undefined;
}
export function OverviewTab({ observability, subagentInsight, runtimeSessionId, runtimeSource }: OverviewTabProps): React.JSX.Element {
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

          <SectionCard title="Phase Breakdown">
            <ObservabilityPhaseBreakdown phases={observability.phaseBreakdown}/>
          </SectionCard>

          <SectionCard title="Top Files">
            <ObservabilityList emptyLabel="No file focus recorded yet." items={observability.focus.topFiles.map((file) => ({
                label: file.path,
                value: `${formatCount(file.count)}x`
            }))}/>
          </SectionCard>

          <SectionCard title="Top Tags">
            <ObservabilityList emptyLabel="No focus tags recorded yet." items={observability.focus.topTags.map((tag) => ({
                label: tag.tag,
                value: `${formatCount(tag.count)}x`
            }))}/>
          </SectionCard>
        </>) : (<div className="rounded-[14px] border border-dashed border-[var(--border)] bg-[var(--bg)] px-4 py-6 text-center">
          <p className="m-0 text-[0.86rem] font-medium text-[var(--text-2)]">No workspace overview available.</p>
          <p className="mt-1.5 mb-0 text-[0.78rem] text-[var(--text-3)]">
            The server will populate this tab once `/api/tasks/:taskId/observability` is available for the selected task.
          </p>
        </div>)}
    </div>);
}
